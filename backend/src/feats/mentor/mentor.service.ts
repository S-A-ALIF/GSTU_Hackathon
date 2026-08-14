import { pool } from '../../config/db.config';
import { notificationService } from '../notification/notification.service';

export const mentorService = {
    async getMentorsList() {
        const query = `
            SELECT 
                u.id, 
                u.email, 
                COALESCE(ui.name, u.email) as name,
                ui.avatar_url,
                (SELECT COUNT(*) FROM teams t WHERE t.mentor_id = u.id) as team_count
            FROM users u
            LEFT JOIN user_info ui ON u.id = ui.user_id
            WHERE u.role = 'mentor'
        `;
        const res = await pool.query(query);
        return res.rows.map(row => ({
            ...row,
            team_count: parseInt(row.team_count, 10)
        }));
    },

    async inviteMentor(leaderId: string, teamId: string, mentorId: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Verify leader and team
            const teamRes = await client.query('SELECT id, name, leader_id, mentor_id FROM teams WHERE id = $1', [teamId]);
            const team = teamRes.rows[0];
            if (!team) throw new Error('Team not found');
            if (team.leader_id !== leaderId) throw new Error('Only the team leader can invite a mentor');
            if (team.mentor_id) throw new Error('Team already has a mentor assigned');

            // 2. Verify mentor
            const mentorRes = await client.query('SELECT id, email, role FROM users WHERE id = $1', [mentorId]);
            const mentor = mentorRes.rows[0];
            if (!mentor || mentor.role !== 'mentor') throw new Error('User is not a mentor');

            // 3. Verify mentor team count
            const countRes = await client.query('SELECT COUNT(*) as count FROM teams WHERE mentor_id = $1', [mentorId]);
            const currentCount = parseInt(countRes.rows[0].count, 10);
            
            const limitRes = await client.query("SELECT value FROM platform_settings WHERE key = 'max_teams_per_mentor'");
            let maxTeams = 3;
            if (limitRes.rows.length > 0 && limitRes.rows[0].value !== 'none' && !isNaN(parseInt(limitRes.rows[0].value, 10))) {
                maxTeams = parseInt(limitRes.rows[0].value, 10);
            }

            if (currentCount >= maxTeams) {
                throw new Error(`Mentor already has ${maxTeams} teams and cannot accept more`);
            }

            // 4. Verify no existing pending invite
            const pendingRes = await client.query('SELECT id FROM mentor_invitations WHERE team_id = $1 AND mentor_id = $2 AND status = $3', [teamId, mentorId, 'pending']);
            if (pendingRes.rows.length > 0) {
                throw new Error('An invitation is already pending for this mentor');
            }

            // 5. Create invite
            await client.query('INSERT INTO mentor_invitations (team_id, mentor_id) VALUES ($1, $2)', [teamId, mentorId]);

            // 6. Notify mentor
            await notificationService.createNotification(
                mentor.email,
                `You have been invited to mentor the team "${team.name}"`,
                'pending'
            );

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getInvitations(mentorId: string) {
        const query = `
            SELECT mi.id, mi.team_id, mi.status, mi.created_at, t.name as team_name, t.leader_id,
                   COALESCE(ui.name, u.email) as leader_name
            FROM mentor_invitations mi
            JOIN teams t ON mi.team_id = t.id
            JOIN users u ON t.leader_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            WHERE mi.mentor_id = $1 AND mi.status = 'pending'
            ORDER BY mi.created_at DESC
        `;
        const res = await pool.query(query, [mentorId]);
        const invitations = res.rows;

        if (invitations.length === 0) return [];

        const teamIds = invitations.map(inv => inv.team_id);
        const membersQuery = `
            SELECT tm.team_id, u.id, u.email, u.role,
                   COALESCE(ui.name, u.email) as name,
                   COALESCE(ui.student_id, 'N/A') as student_id,
                   COALESCE(ui.batch_session, 'N/A') as batch_session
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            WHERE tm.team_id = ANY($1)
        `;
        const membersRes = await pool.query(membersQuery, [teamIds]);

        return invitations.map(inv => ({
            ...inv,
            members: membersRes.rows.filter(m => m.team_id === inv.team_id)
        }));
    },

    async respondToInvitation(mentorId: string, invitationId: string, accept: boolean, message?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const invRes = await client.query('SELECT team_id, status FROM mentor_invitations WHERE id = $1 AND mentor_id = $2', [invitationId, mentorId]);
            const inv = invRes.rows[0];
            if (!inv) throw new Error('Invitation not found');
            if (inv.status !== 'pending') throw new Error('Invitation already processed');

            // Fetch team to get leader email
            const teamRes = await client.query('SELECT mentor_id, name, leader_id FROM teams WHERE id = $1', [inv.team_id]);
            const team = teamRes.rows[0];
            if (!team) throw new Error('Team not found');

            const leaderEmailRes = await client.query('SELECT email FROM users WHERE id = $1', [team.leader_id]);
            const leaderEmail = leaderEmailRes.rows[0]?.email;
            
            const mentorUserRes = await client.query('SELECT COALESCE(ui.name, u.email) as name FROM users u LEFT JOIN user_info ui ON u.id = ui.user_id WHERE u.id = $1', [mentorId]);
            const mentorName = mentorUserRes.rows[0]?.name || 'A mentor';

            if (accept) {
                // Verify team doesn't have a mentor already
                if (team.mentor_id) {
                    await client.query('UPDATE mentor_invitations SET status = $1 WHERE id = $2', ['rejected', invitationId]);
                    throw new Error('Team already has a mentor');
                }

                // Verify mentor has < max teams
                const countRes = await client.query('SELECT COUNT(*) as count FROM teams WHERE mentor_id = $1', [mentorId]);
                const currentCount = parseInt(countRes.rows[0].count, 10);
                
                const limitRes = await client.query("SELECT value FROM platform_settings WHERE key = 'max_teams_per_mentor'");
                let maxTeams = 3;
                if (limitRes.rows.length > 0 && limitRes.rows[0].value !== 'none' && !isNaN(parseInt(limitRes.rows[0].value, 10))) {
                    maxTeams = parseInt(limitRes.rows[0].value, 10);
                }

                if (currentCount >= maxTeams) {
                    throw new Error(`You cannot mentor more than ${maxTeams} teams`);
                }

                // Assign mentor
                await client.query('UPDATE teams SET mentor_id = $1 WHERE id = $2', [mentorId, inv.team_id]);
                await client.query('UPDATE mentor_invitations SET status = $1 WHERE id = $2', ['accepted', invitationId]);

                // Reject all other pending invitations for this team
                await client.query('UPDATE mentor_invitations SET status = $1 WHERE team_id = $2 AND status = $3', ['rejected', inv.team_id, 'pending']);

                // Notify team leader
                if (leaderEmail) {
                    await notificationService.createNotification(
                        leaderEmail,
                        `${mentorName} has accepted your invitation to mentor "${team.name}"`,
                        null
                    );
                }
            } else {
                await client.query('UPDATE mentor_invitations SET status = $1 WHERE id = $2', ['rejected', invitationId]);
                
                // Notify team leader on rejection
                if (leaderEmail) {
                    const notifMsg = message 
                        ? `${mentorName} has declined your invitation to mentor "${team.name}". Message: ${message}`
                        : `${mentorName} has declined your invitation to mentor "${team.name}".`;
                        
                    await notificationService.createNotification(
                        leaderEmail,
                        notifMsg,
                        null
                    );
                }
            }

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    async getMentoredTeams(mentorId: string) {
        // Get teams
        const teamQuery = `
            SELECT id, name, team_code, created_at, leader_id 
            FROM teams 
            WHERE mentor_id = $1
        `;
        const teamsRes = await pool.query(teamQuery, [mentorId]);
        const teams = teamsRes.rows;

        if (teams.length === 0) return [];

        // Get members for all these teams
        const teamIds = teams.map(t => t.id);
        const membersQuery = `
            SELECT tm.team_id, u.id, u.email, u.role,
                   COALESCE(ui.name, u.email) as name,
                   COALESCE(ui.student_id, 'N/A') as student_id,
                   COALESCE(ui.batch_session, 'N/A') as batch_session,
                   ui.avatar_url
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            WHERE tm.team_id = ANY($1)
        `;
        const membersRes = await pool.query(membersQuery, [teamIds]);

        return teams.map(team => ({
            ...team,
            members: membersRes.rows.filter(m => m.team_id === team.id)
        }));
    },

    async resignMentorship(mentorId: string, teamId: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const teamRes = await client.query('SELECT mentor_id, name, leader_id FROM teams WHERE id = $1', [teamId]);
            const team = teamRes.rows[0];
            if (!team) throw new Error('Team not found');
            if (team.mentor_id !== mentorId) throw new Error('You are not the mentor of this team');

            // Remove mentor from team
            await client.query('UPDATE teams SET mentor_id = NULL WHERE id = $1', [teamId]);

            // Notify team leader
            const leaderEmailRes = await client.query('SELECT email FROM users WHERE id = $1', [team.leader_id]);
            const leaderEmail = leaderEmailRes.rows[0]?.email;
            if (leaderEmail) {
                const mentorUserRes = await client.query('SELECT COALESCE(ui.name, u.email) as name FROM users u LEFT JOIN user_info ui ON u.id = ui.user_id WHERE u.id = $1', [mentorId]);
                const mentorName = mentorUserRes.rows[0]?.name || 'Your mentor';
                
                await notificationService.createNotification(
                    leaderEmail,
                    `${mentorName} has resigned as the mentor for your team "${team.name}".`,
                    null
                );
            }

            await client.query('COMMIT');
            return { success: true };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }
};

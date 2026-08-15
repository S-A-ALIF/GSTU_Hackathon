import { pool } from '../../config/db.config';
import { sendEmail } from '../email/email.service';
import { notificationService } from '../notification/notification.service';

// Utility to generate a random uppercase Gamer Tag ID like TM-9X2P7Q
const generateTeamCode = () => {
    const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `TM-${code}`;
};

export const teamService = {
    /**
     * Get a user's current team details including members and min/max limits.
     */
    async getMyTeamDetails(userId: string) {
        // 1. Get the team ID for this user
        const memberRes = await pool.query('SELECT team_id FROM team_members WHERE user_id = $1', [userId]);
        const teamId = memberRes.rows[0]?.team_id;
        
        if (!teamId) return null;

        // 2. Fetch team details, team members, and platform settings in PARALLEL
        const membersQuery = `
            SELECT u.id, u.email, u.role,
                   COALESCE(ui.name, u.email) as name,
                   COALESCE(ui.student_id, 'N/A') as student_id,
                   COALESCE(ui.batch_session, 'N/A') as batch_session,
                   COALESCE(ui.phone_number, 'N/A') as phone_number,
                   ui.avatar_url
            FROM team_members tm
            JOIN users u ON tm.user_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            WHERE tm.team_id = $1
        `;

        const [teamRes, membersRes, settingsRes] = await Promise.all([
            pool.query('SELECT t.id, t.name, t.team_code, t.leader_id, t.mentor_id, t.repo_url, t.live_url, t.video_url, COALESCE(t.is_submitted, false) as is_submitted, t.submitted_at, COALESCE(t.is_full, false) as is_full, t.created_at, COALESCE(ui.name, u.email) as mentor_name, ui.avatar_url as mentor_avatar_url FROM teams t LEFT JOIN users u ON t.mentor_id = u.id LEFT JOIN user_info ui ON u.id = ui.user_id WHERE t.id = $1', [teamId]),
            pool.query(membersQuery, [teamId]),
            pool.query("SELECT key, value FROM platform_settings WHERE key IN ('min_team_members', 'max_team_members')")
        ]);

        const team = teamRes.rows[0];

        const minVal = settingsRes.rows.find(r => r.key === 'min_team_members')?.value;
        const maxVal = settingsRes.rows.find(r => r.key === 'max_team_members')?.value;
        const parseLimit = (val: string | undefined, def: number | null): number | null => {
            if (val === undefined || val === null) return def;
            if (val === '' || val === 'none' || val === 'null') return null;
            const n = parseInt(val, 10);
            return isNaN(n) ? null : n;
        };
        const minMembers = parseLimit(minVal, 3);
        const maxMembers = parseLimit(maxVal, 5);

        return {
            ...team,
            members: membersRes.rows,
            minMembers,
            maxMembers
        };
    },

    /**
     * Get a user's current team ID, if any.
     */
    async getUserTeam(userId: string) {
        const res = await pool.query('SELECT team_id FROM team_members WHERE user_id = $1', [userId]);
        return res.rows[0]?.team_id || null;
    },

    /**
     * Create a new team with Gamer-Tag code and add the creator as the first member.
     */
    async createTeam(userId: string, teamName: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            
            // Check if already in a team
            const existing = await client.query('SELECT team_id FROM team_members WHERE user_id = $1', [userId]);
            if (existing.rows.length > 0) {
                throw new Error('User is already in a team.');
            }

            // Generate unique team code
            let teamCode = generateTeamCode();
            let isUnique = false;
            while (!isUnique) {
                const checkRes = await client.query('SELECT id FROM teams WHERE team_code = $1', [teamCode]);
                if (checkRes.rows.length === 0) {
                    isUnique = true;
                } else {
                    teamCode = generateTeamCode();
                }
            }

            // Create team
            const teamRes = await client.query(
                'INSERT INTO teams (name, team_code, leader_id) VALUES ($1, $2, $3) RETURNING id, team_code',
                [teamName, teamCode, userId]
            );
            const teamId = teamRes.rows[0].id;

            // Add leader as member
            await client.query(
                'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)',
                [teamId, userId]
            );

            await client.query('COMMIT');
            return teamId;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Generate an in-app invitation without email PIN verification
     */
    async inviteMember(inviterId: string, inviterEmail: string, teamId: string, inviteeEmail: string) {
        const cleanEmail = inviteeEmail.trim();
        // 1. Check if invitee is registered and whether they are already in a team
        const targetUserRes = await pool.query("SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1)", [cleanEmail]);
        if (targetUserRes.rows.length === 0) {
            throw new Error(`No user found with email "${cleanEmail}". They must register an account first.`);
        }
        
        if (targetUserRes.rows[0].role === 'admin') {
            throw new Error(`You cannot invite an administrator to your team.`);
        }
        
        const inviteeUserId = targetUserRes.rows[0].id;
        const actualEmail = targetUserRes.rows[0].email;

        if (inviteeUserId === inviterId) {
            throw new Error('You cannot invite yourself to your own team.');
        }

        const existingMember = await pool.query('SELECT team_id FROM team_members WHERE user_id = $1', [inviteeUserId]);
        if (existingMember.rows.length > 0) {
            throw new Error(`${actualEmail} is already a member of a team and cannot be invited.`);
        }

        // 2. Check max team member limit & if team is declared full
        const teamCheck = await pool.query('SELECT is_full FROM teams WHERE id = $1', [teamId]);
        if (teamCheck.rows[0]?.is_full) {
            throw new Error('You have declared your team full. Please reopen your team before inviting new members.');
        }

        const countRes = await pool.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1', [teamId]);
        const count = parseInt(countRes.rows[0].count, 10);
        const maxRes = await pool.query("SELECT value FROM platform_settings WHERE key = 'max_team_members'");
        const maxVal = maxRes.rows[0]?.value;
        const maxMembers = maxVal && maxVal !== 'none' && maxVal !== '' && !isNaN(parseInt(maxVal, 10)) ? parseInt(maxVal, 10) : null;
        if (maxMembers !== null && count >= maxMembers) {
            throw new Error(`Your team has already reached the maximum limit of ${maxMembers} members.`);
        }

        // 3. Get team name
        const teamRes = await pool.query('SELECT name FROM teams WHERE id = $1', [teamId]);
        const teamName = teamRes.rows[0]?.name || 'a team';

        // 4. Check cooldown for recent invite
        const existingInviteRes = await pool.query(
            'SELECT id, created_at FROM team_invitations WHERE team_id = $1 AND LOWER(email) = LOWER($2) AND is_used = false AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
            [teamId, inviteeEmail]
        );

        if (existingInviteRes.rows.length > 0) {
            const existingInvite = existingInviteRes.rows[0];
            const createdTime = new Date(existingInvite.created_at).getTime();
            if (Date.now() - createdTime < 60000) {
                throw new Error(`An invitation was just sent to ${inviteeEmail}. Please wait 60 seconds before sending another.`);
            }
        } else {
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48);
            await pool.query(
                'INSERT INTO team_invitations (team_id, email, pin_code, expires_at) VALUES ($1, $2, $3, $4)',
                [teamId, inviteeEmail, 'INAPP', expiresAt]
            );
        }

        // 5. Get inviter name and send in-app notification with pending action
        const inviterRes = await pool.query(
            'SELECT COALESCE(ui.name, u.email) as sender_name FROM users u LEFT JOIN user_info ui ON u.id = ui.user_id WHERE u.id = $1',
            [inviterId]
        );
        const senderName = inviterRes.rows[0]?.sender_name || inviterEmail;

        await notificationService.createNotification(
            inviteeEmail,
            `You received a team invitation from ${senderName} to join team "${teamName}" [TeamID:${teamId}].`,
            'pending'
        );

        return { success: true, emailSent: false, pinCode: null };
    },

    /**
     * Request to join a team using Gamer-Tag Team Code (e.g. TM-XXXXXX)
     */
    async requestToJoinByCode(userId: string, userEmail: string, teamCode: string) {
        // 1. Check if user is already in a team
        const existing = await pool.query('SELECT team_id FROM team_members WHERE user_id = $1', [userId]);
        if (existing.rows.length > 0) {
            throw new Error('You are already in a team.');
        }

        // 2. Check if user profile is completed (name, student_id, batch_session)
        const profileRes = await pool.query('SELECT name, student_id, batch_session FROM user_info WHERE user_id = $1', [userId]);
        const profile = profileRes.rows[0];
        if (!profile || !profile.name || !profile.student_id || !profile.batch_session) {
            throw new Error('Please fill up your profile information (Name, Student ID, and Batch/Session) before joining a team.');
        }

        // 3. Find team by code
        const teamRes = await pool.query(
            'SELECT t.id, t.name, t.is_full, u.email as leader_email FROM teams t JOIN users u ON t.leader_id = u.id WHERE LOWER(t.team_code) = LOWER($1)',
            [teamCode.trim()]
        );
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error(`Invalid Team Code "${teamCode}". Please check the code and try again.`);
        }
        if (team.is_full) {
            throw new Error(`Team "${team.name}" has been declared full by the team leader and is not accepting join requests.`);
        }

        // 3. Check team member limit
        const countRes = await pool.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1', [team.id]);
        const count = parseInt(countRes.rows[0].count, 10);
        const maxRes = await pool.query("SELECT value FROM platform_settings WHERE key = 'max_team_members'");
        const maxVal = maxRes.rows[0]?.value;
        const maxMembers = maxVal && maxVal !== 'none' && maxVal !== '' && !isNaN(parseInt(maxVal, 10)) ? parseInt(maxVal, 10) : null;
        if (maxMembers !== null && count >= maxMembers) {
            throw new Error(`Team "${team.name}" has already reached the maximum limit of ${maxMembers} members.`);
        }

        // 4. Check for existing pending join request
        const reqRes = await pool.query(
            'SELECT id FROM team_join_requests WHERE team_id = $1 AND user_id = $2 AND status = $3',
            [team.id, userId, 'pending']
        );
        if (reqRes.rows.length > 0) {
            throw new Error(`You already have a pending join request for team "${team.name}".`);
        }

        // 5. Insert join request
        const insertRes = await pool.query(
            'INSERT INTO team_join_requests (team_id, user_id, status) VALUES ($1, $2, $3) RETURNING id',
            [team.id, userId, 'pending']
        );
        const requestId = insertRes.rows[0].id;

        // 6. Send in-app notification to team leader
        await notificationService.createNotification(
            team.leader_email,
            `${userEmail} has requested to join your team "${team.name}" [ReqID:${requestId}]`,
            'pending'
        );

        return { success: true, teamName: team.name, requestId };
    },

    /**
     * Join a team using a PIN code
     */
    async joinTeamWithPin(userId: string, pinCode: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Check if user is already in a team
            const existing = await client.query('SELECT team_id FROM team_members WHERE user_id = $1', [userId]);
            if (existing.rows.length > 0) {
                throw new Error('You are already in a team.');
            }

            // 2. Validate PIN
            const inviteRes = await client.query(
                'SELECT * FROM team_invitations WHERE pin_code = $1 AND is_used = false AND expires_at > NOW()',
                [pinCode]
            );

            if (inviteRes.rows.length === 0) {
                throw new Error('Invalid or expired PIN code.');
            }

            const invitation = inviteRes.rows[0];

            // 2.5 Check if team is declared full or reached maximum members limit
            const teamCheck = await client.query('SELECT name, is_full FROM teams WHERE id = $1', [invitation.team_id]);
            if (teamCheck.rows[0]?.is_full) {
                throw new Error('This team has been declared full by the team leader and cannot accept new members.');
            }
            const countRes = await client.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1', [invitation.team_id]);
            const count = parseInt(countRes.rows[0].count, 10);
            const maxRes = await client.query("SELECT value FROM platform_settings WHERE key = 'max_team_members'");
            const maxVal = maxRes.rows[0]?.value;
            const maxMembers = maxVal && maxVal !== 'none' && maxVal !== '' && !isNaN(parseInt(maxVal, 10)) ? parseInt(maxVal, 10) : null;
            if (maxMembers !== null && count >= maxMembers) {
                throw new Error(`This team has already reached the maximum limit of ${maxMembers} members.`);
            }

            // 3. Add to team
            await client.query(
                'INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)',
                [invitation.team_id, userId]
            );

            // 4. Mark PIN as used
            await client.query(
                'UPDATE team_invitations SET is_used = true WHERE id = $1',
                [invitation.id]
            );

            // 5. Query team leader email and joining user email to send acceptance confirmation notification
            const leaderRes = await client.query(
                `SELECT t.name as team_name, u.email as leader_email 
                 FROM teams t 
                 JOIN users u ON t.leader_id = u.id 
                 WHERE t.id = $1`,
                [invitation.team_id]
            );

            const userRes = await client.query('SELECT email FROM users WHERE id = $1', [userId]);

            if (leaderRes.rows.length > 0 && userRes.rows.length > 0) {
                const leaderEmail = leaderRes.rows[0].leader_email;
                const teamName = leaderRes.rows[0].team_name;
                const joiningEmail = userRes.rows[0].email;

                await client.query(
                    'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                    [leaderEmail, `${joiningEmail} has accepted your invitation and joined team "${teamName}"!`]
                );

                await client.query(
                    "UPDATE notifications SET action_status = 'accepted', is_read = true WHERE recipient_email = $1 AND message LIKE '%You received a team invitation%' AND (action_status IS NULL OR action_status = 'pending')",
                    [joiningEmail]
                );
            }

            await client.query('COMMIT');
            return { success: true, teamId: invitation.team_id };
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Remove a member from the team (Leader only)
     */
    async removeMember(leaderId: string, memberIdToRemove: string) {
        if (leaderId === memberIdToRemove) {
            throw new Error('Team leader cannot remove themselves. Use leave or disband instead.');
        }

        const teamRes = await pool.query('SELECT id, leader_id FROM teams WHERE leader_id = $1', [leaderId]);
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error('Only the team leader can remove members.');
        }

        const res = await pool.query(
            'DELETE FROM team_members WHERE team_id = $1 AND user_id = $2 RETURNING *',
            [team.id, memberIdToRemove]
        );

        if (res.rowCount === 0) {
            throw new Error('Member not found in team.');
        }

        return { success: true };
    },

    /**
     * Leave a team (Member or Leader if only member)
     */
    async leaveTeam(userId: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const memberRes = await client.query('SELECT team_id FROM team_members WHERE user_id = $1', [userId]);
            const teamId = memberRes.rows[0]?.team_id;
            if (!teamId) {
                throw new Error('You are not in any team.');
            }

            const teamRes = await client.query('SELECT id, name, leader_id FROM teams WHERE id = $1', [teamId]);
            const team = teamRes.rows[0];

            if (team.leader_id === userId) {
                const countRes = await client.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1', [teamId]);
                const count = parseInt(countRes.rows[0].count, 10);
                if (count > 1) {
                    throw new Error('You cannot leave the team unless you transfer leadership to another member first.');
                } else {
                    // Leader was only member; disband team
                    await client.query('DELETE FROM teams WHERE id = $1', [teamId]);
                    await client.query('COMMIT');
                    return { success: true, disbanded: true };
                }
            }

            const userRes = await client.query('SELECT COALESCE(ui.name, u.email) as name FROM users u LEFT JOIN user_info ui ON u.id = ui.user_id WHERE u.id = $1', [userId]);
            const userName = userRes.rows[0]?.name || 'A member';
            
            const leaderEmailRes = await client.query('SELECT email FROM users WHERE id = $1', [team.leader_id]);
            const leaderEmail = leaderEmailRes.rows[0]?.email;

            await client.query('DELETE FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);

            if (leaderEmail) {
                await notificationService.createNotification(
                    leaderEmail,
                    `${userName} has left your team "${team.name}".`,
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
    },

    /**
     * Disband the entire team (Leader only)
     */
    async disbandTeam(leaderId: string) {
        const teamRes = await pool.query('SELECT id FROM teams WHERE leader_id = $1', [leaderId]);
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error('Only the team leader can disband the team.');
        }

        await pool.query('DELETE FROM teams WHERE id = $1', [team.id]);
        return { success: true };
    },

    /**
     * Update team name (Leader only)
     */
    async updateTeamName(leaderId: string, newName: string) {
        const cleanName = newName.trim();
        if (!cleanName) {
            throw new Error('Team name cannot be empty.');
        }

        const teamRes = await pool.query('SELECT id FROM teams WHERE leader_id = $1', [leaderId]);
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error('Only the team leader can change the team name.');
        }

        const existingRes = await pool.query('SELECT id FROM teams WHERE LOWER(name) = LOWER($1) AND id != $2', [cleanName, team.id]);
        if (existingRes.rows.length > 0) {
            throw new Error('A team with that name already exists.');
        }

        const updatedRes = await pool.query('UPDATE teams SET name = $1 WHERE id = $2 RETURNING *', [cleanName, team.id]);
        return updatedRes.rows[0];
    },

    /**
     * Transfer team leadership to another team member (Leader only)
     */
    async transferLeadership(leaderId: string, newLeaderUserId: string) {
        const teamRes = await pool.query('SELECT id, name FROM teams WHERE leader_id = $1', [leaderId]);
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error('Only the team leader can transfer leadership.');
        }

        if (leaderId === newLeaderUserId) {
            throw new Error('You are already the team leader.');
        }

        const memberCheck = await pool.query('SELECT user_id FROM team_members WHERE team_id = $1 AND user_id = $2', [team.id, newLeaderUserId]);
        if (memberCheck.rows.length === 0) {
            throw new Error('Target user is not a member of this team.');
        }

        await pool.query('UPDATE teams SET leader_id = $1 WHERE id = $2', [newLeaderUserId, team.id]);

        // Notify new leader
        const targetUserRes = await pool.query('SELECT email FROM users WHERE id = $1', [newLeaderUserId]);
        if (targetUserRes.rows[0]) {
            await pool.query(
                'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                [targetUserRes.rows[0].email, `You have been made the new team leader of "${team.name}".`]
            );
        }

        return { success: true };
    },

    /**
     * Declare team full or reopen it (Leader only)
     */
    async updateTeamStatus(userId: string, isFull: boolean) {
        const memberRes = await pool.query('SELECT team_id FROM team_members WHERE user_id = $1', [userId]);
        const teamId = memberRes.rows[0]?.team_id;
        if (!teamId) {
            throw new Error('You are not in a team.');
        }

        const teamRes = await pool.query('SELECT id, leader_id, name, is_full FROM teams WHERE id = $1', [teamId]);
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error('Team not found.');
        }
        if (team.leader_id !== userId) {
            throw new Error('Only the team leader can declare the team full or reopen it.');
        }

        const updatedRes = await pool.query(
            'UPDATE teams SET is_full = $1 WHERE id = $2 RETURNING id, is_full',
            [Boolean(isFull), teamId]
        );

        return { success: true, is_full: updatedRes.rows[0].is_full };
    },

    /**
     * Get active sent invitations for a team (Leader only)
     */
    async getActiveInvitations(leaderId: string) {
        const teamRes = await pool.query('SELECT id, name FROM teams WHERE leader_id = $1', [leaderId]);
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error('Only the team leader can view active invitations.');
        }

        const query = `
            SELECT ti.id, ti.email, ti.expires_at, ti.created_at, COALESCE(ui.name, ti.email) as invitee_name
            FROM team_invitations ti
            LEFT JOIN users u ON LOWER(u.email) = LOWER(ti.email)
            LEFT JOIN user_info ui ON u.id = ui.user_id
            WHERE ti.team_id = $1 AND ti.is_used = false AND ti.expires_at > NOW()
            ORDER BY ti.created_at DESC
        `;
        const res = await pool.query(query, [team.id]);
        return res.rows;
    },

    /**
     * Cancel an active sent invitation (Leader only)
     */
    async cancelInvitation(leaderId: string, invitationId: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const teamRes = await client.query('SELECT id FROM teams WHERE leader_id = $1', [leaderId]);
            const team = teamRes.rows[0];
            if (!team) {
                throw new Error('Only the team leader can cancel invitations.');
            }

            const invRes = await client.query(
                'SELECT * FROM team_invitations WHERE id = $1 AND team_id = $2 AND is_used = false',
                [invitationId, team.id]
            );
            const invitation = invRes.rows[0];
            if (!invitation) {
                throw new Error('Active invitation not found.');
            }

            await client.query('UPDATE team_invitations SET is_used = true WHERE id = $1', [invitationId]);

            await client.query(
                "DELETE FROM notifications WHERE LOWER(recipient_email) = LOWER($1) AND message LIKE '%' || $2 || '%' AND action_status = 'pending'",
                [invitation.email, `[TeamID:${team.id}]`]
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

    /**
     * Update submission links (Leader only, before final submission)
     */
    async updateSubmissionLinks(leaderId: string, repoUrl: string, liveUrl: string, videoUrl: string) {
        const teamRes = await pool.query('SELECT id, name, COALESCE(is_submitted, false) as is_submitted FROM teams WHERE leader_id = $1', [leaderId]);
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error('Only the team leader can update the submission links.');
        }
        if (team.is_submitted) {
            throw new Error('Project has already been submitted and cannot be edited.');
        }

        // Check if submission is open
        const settingsRes = await pool.query("SELECT key, value FROM platform_settings WHERE key IN ('hack_start_time', 'hack_end_time', 'workspace_open', 'hack_override')");
        const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>);
        
        const startTime = settings.hack_start_time;
        const endTime = settings.hack_end_time;
        const override = settings.hack_override === 'true';
        const now = new Date();
        let isSubOpen = true;

        if (override) {
            isSubOpen = settings.workspace_open === 'true';
        } else if (startTime && endTime) {
            isSubOpen = now >= new Date(startTime) && now <= new Date(endTime);
        } else if (startTime) {
            isSubOpen = now >= new Date(startTime);
        } else if (endTime) {
            isSubOpen = now <= new Date(endTime);
        }

        if (!isSubOpen) {
            throw new Error('Project submission is currently closed.');
        }

        await pool.query(
            'UPDATE teams SET repo_url = $1, live_url = $2, video_url = $3 WHERE id = $4',
            [repoUrl, liveUrl, videoUrl, team.id]
        );
        return { success: true, repo_url: repoUrl, live_url: liveUrl, video_url: videoUrl };
    },

    /**
     * Permanently submit project repository (Leader only)
     */
    async submitProject(leaderId: string) {
        const teamRes = await pool.query('SELECT id, name, repo_url, live_url, video_url, mentor_id, COALESCE(is_submitted, false) as is_submitted FROM teams WHERE leader_id = $1', [leaderId]);
        const team = teamRes.rows[0];
        if (!team) {
            throw new Error('Only the team leader can submit the project.');
        }
        if (team.is_submitted) {
            throw new Error('Project is already submitted.');
        }
        if (!team.repo_url?.trim() || !team.live_url?.trim() || !team.video_url?.trim()) {
            throw new Error('Please save all three valid submission links (Live Site, Video, and GitHub Repo) before submitting.');
        }

        // Check if submission is open
        const settingsRes = await pool.query("SELECT key, value FROM platform_settings WHERE key IN ('hack_start_time', 'hack_end_time', 'workspace_open', 'hack_override')");
        const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>);
        
        const startTime = settings.hack_start_time;
        const endTime = settings.hack_end_time;
        const override = settings.hack_override === 'true';
        const now = new Date();
        let isSubOpen = true;

        if (override) {
            isSubOpen = settings.workspace_open === 'true';
        } else if (startTime && endTime) {
            isSubOpen = now >= new Date(startTime) && now <= new Date(endTime);
        } else if (startTime) {
            isSubOpen = now >= new Date(startTime);
        } else if (endTime) {
            isSubOpen = now <= new Date(endTime);
        }

        if (!isSubOpen) {
            throw new Error('Project submission is currently closed.');
        }

        await pool.query('UPDATE teams SET is_submitted = true, submitted_at = CURRENT_TIMESTAMP WHERE id = $1', [team.id]);

        // Notify all team members
        const membersRes = await pool.query(
            'SELECT u.email FROM team_members tm JOIN users u ON tm.user_id = u.id WHERE tm.team_id = $1',
            [team.id]
        );
        for (const m of membersRes.rows) {
            if (m.email) {
                await pool.query(
                    'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                    [m.email, 'Your Team has officially submitted the project repository!']
                );
            }
        }

        // Notify the mentor (if the team has one)
        if (team.mentor_id) {
            const mentorRes = await pool.query('SELECT email FROM users WHERE id = $1', [team.mentor_id]);
            const mentorEmail = mentorRes.rows[0]?.email;
            if (mentorEmail) {
                await pool.query(
                    'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                    [mentorEmail, `Team "${team.name}" has officially submitted the project repository!`]
                );
            }
        }

        return { success: true, is_submitted: true };
    }
};


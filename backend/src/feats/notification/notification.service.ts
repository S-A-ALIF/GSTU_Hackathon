import { pool } from '../../config/db.config';

export const notificationService = {
    /**
     * Get all notifications for a specific email
     */
    async getNotificationsByEmail(email: string, skipUpdate: boolean = false) {
        try {
            if (!skipUpdate) {
                await pool.query(
                    `UPDATE notifications
                     SET action_status = 'expired'
                     WHERE LOWER(recipient_email) = LOWER($1)
                       AND (
                           type IN ('team_invitation', 'join_request', 'mentor_invitation')
                           OR message LIKE '%You received a team invitation%'
                           OR message LIKE '%requested to join your team%'
                           OR message LIKE '%invited to mentor the team%'
                       )
                       AND (action_status IS NULL OR action_status = 'pending')
                       AND (
                           created_at < NOW() - INTERVAL '48 hours'
                           OR (message LIKE '%You received a team invitation%' AND NOT EXISTS (
                               SELECT 1 FROM team_invitations 
                               WHERE LOWER(email) = LOWER($1) AND is_used = false AND expires_at > NOW()
                           ))
                           OR (message LIKE '%requested to join your team%' AND NOT EXISTS (
                               SELECT 1 FROM team_join_requests 
                               WHERE status = 'pending' AND created_at > NOW() - INTERVAL '48 hours'
                           ))
                           OR (message LIKE '%invited to mentor the team%' AND NOT EXISTS (
                               SELECT 1 FROM mentor_invitations mi
                               JOIN teams t ON mi.team_id = t.id
                               JOIN users u ON mi.mentor_id = u.id
                               WHERE LOWER(u.email) = LOWER($1) AND mi.status = 'pending'
                                 AND (message LIKE '%invited to mentor the team "' || t.name || '"%')
                           ))
                       )`,
                    [email]
                );
            }

            const result = await pool.query(
                'SELECT * FROM notifications WHERE recipient_email = $1 ORDER BY created_at DESC',
                [email]
            );
            return result.rows;
        } catch (error) {
            console.error('[NotificationService] Error getting notifications:', error);
            throw error;
        }
    },

    /**
     * Mark a specific notification as read (unless it is a pending invitation or join request)
     */
    async markAsRead(id: string) {
        try {
            const result = await pool.query(
                `UPDATE notifications 
                 SET is_read = true 
                 WHERE id = $1 
                   AND NOT (
                       (
                           COALESCE(type, '') IN ('team_invitation', 'join_request', 'mentor_invitation')
                           OR message LIKE '%You received a team invitation%'
                           OR message LIKE '%requested to join your team%'
                           OR message LIKE '%invited to mentor the team%'
                       )
                       AND (action_status IS NULL OR action_status = 'pending')
                   )
                 RETURNING *`,
                [id]
            );
            return result.rows[0];
        } catch (error) {
            console.error('[NotificationService] Error marking notification as read:', error);
            throw error;
        }
    },

    /**
     * Create a new notification
     */
    async createNotification(email: string, message: string, actionStatus: string | null = null, type: string | null = null) {
        try {
            const result = await pool.query(
                'INSERT INTO notifications (recipient_email, message, action_status, type) VALUES ($1, $2, $3, $4) RETURNING *',
                [email, message, actionStatus, type]
            );
            return result.rows[0];
        } catch (error) {
            console.error('[NotificationService] Error creating notification:', error);
            throw error;
        }
    },

    /**
     * Mark all notifications as read for an email (unless they are pending invitations or join requests)
     */
    async markAllAsRead(email: string) {
        try {
            const result = await pool.query(
                `UPDATE notifications 
                 SET is_read = true 
                 WHERE recipient_email = $1 
                   AND NOT (
                       (
                           COALESCE(type, '') IN ('team_invitation', 'join_request', 'mentor_invitation')
                           OR message LIKE '%You received a team invitation%'
                           OR message LIKE '%requested to join your team%'
                           OR message LIKE '%invited to mentor the team%'
                       )
                       AND (action_status IS NULL OR action_status = 'pending')
                   )
                 RETURNING *`,
                [email]
            );
            return result.rows;
        } catch (error) {
            console.error('[NotificationService] Error marking all notifications as read:', error);
            throw error;
        }
    },

    /**
     * Delete a specific notification by ID
     */
    async deleteNotification(id: string) {
        try {
            const result = await pool.query(
                'DELETE FROM notifications WHERE id = $1 RETURNING *',
                [id]
            );
            return result.rows[0];
        } catch (error) {
            console.error('[NotificationService] Error deleting notification:', error);
            throw error;
        }
    },

    /**
     * Reject a team invitation or join request notification
     */
    async rejectTeamInvitation(id: string, userEmail: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const notifRes = await client.query('SELECT * FROM notifications WHERE id = $1', [id]);
            const notif = notifRes.rows[0];
            if (!notif) {
                throw new Error('Notification not found.');
            }

            if (notif.message.includes('team invitation')) {
                // Extract TeamID first so we only invalidate the invitation from THIS specific team
                const match = notif.message.match(/\[TeamID:([a-fA-F0-9-]+)\]/);
                if (match) {
                    const teamId = match[1];
                    // Invalidate ONLY the invitation from this specific team (not all teams)
                    await client.query(
                        'UPDATE team_invitations SET is_used = true WHERE LOWER(email) = LOWER($1) AND team_id = $2 AND is_used = false',
                        [userEmail, teamId]
                    );
                    // Notify leader
                    const leaderRes = await client.query(
                        'SELECT t.name, u.email FROM teams t JOIN users u ON t.leader_id = u.id WHERE t.id = $1',
                        [teamId]
                    );
                    if (leaderRes.rows[0]) {
                        await client.query(
                            'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                            [leaderRes.rows[0].email, `${userEmail} has declined your invitation to join team "${leaderRes.rows[0].name}".`]
                        );
                    }
                } else {
                    // Fallback if no TeamID tag found: only invalidate by email (old behaviour)
                    await client.query(
                        'UPDATE team_invitations SET is_used = true WHERE LOWER(email) = LOWER($1) AND is_used = false',
                        [userEmail]
                    );
                }
            } else if (notif.message.includes('requested to join your team')) {
                const match = notif.message.match(/\[ReqID:([a-fA-F0-9-]+)\]/);
                if (match) {
                    const reqRes = await client.query('SELECT * FROM team_join_requests WHERE id = $1', [match[1]]);
                    if (reqRes.rows[0]) {
                        await client.query("UPDATE team_join_requests SET status = 'rejected' WHERE id = $1", [match[1]]);
                        const userRes = await client.query('SELECT email FROM users WHERE id = $1', [reqRes.rows[0].user_id]);
                        const teamRes = await client.query('SELECT name FROM teams WHERE id = $1', [reqRes.rows[0].team_id]);
                        if (userRes.rows[0] && teamRes.rows[0]) {
                            await client.query(
                                'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                                [userRes.rows[0].email, `Your request to join team "${teamRes.rows[0].name}" was DECLINED.`]
                            );
                        }
                    }
                }
            } else if (notif.message.includes('invited to mentor the team')) {
                const userEmailToUse = userEmail;
                if (!userEmailToUse) throw new Error('User email is required.');
                const userRes = await client.query('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [userEmailToUse]);
                const user = userRes.rows[0];
                if (!user) throw new Error('User not found.');

                const match = notif.message.match(/invited to mentor the team "([^"]+)"/);
                if (!match) throw new Error('Invalid mentor invitation format.');
                const teamName = match[1];

                const invRes = await client.query(`
                    SELECT mi.id, mi.team_id, t.leader_id 
                    FROM mentor_invitations mi
                    JOIN teams t ON mi.team_id = t.id
                    WHERE mi.mentor_id = $1 AND t.name = $2 AND mi.status = 'pending'
                `, [user.id, teamName]);
                const inv = invRes.rows[0];

                if (inv) {
                     await client.query("UPDATE mentor_invitations SET status = 'rejected' WHERE id = $1", [inv.id]);
                     
                     const leaderRes = await client.query('SELECT email FROM users WHERE id = $1', [inv.leader_id]);
                     if (leaderRes.rows[0]) {
                         const mentorUserRes = await client.query('SELECT COALESCE(ui.name, u.email) as name FROM users u LEFT JOIN user_info ui ON u.id = ui.user_id WHERE u.id = $1', [user.id]);
                         const mentorName = mentorUserRes.rows[0]?.name || 'A mentor';
                         await client.query('INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)', [leaderRes.rows[0].email, `${mentorName} has declined your invitation to mentor "${teamName}".`]);
                     }
                }
            }

            const result = await client.query(
                "UPDATE notifications SET action_status = 'rejected', is_read = true WHERE id = $1 RETURNING *",
                [id]
            );
            await client.query('COMMIT');
            return result.rows[0];
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[NotificationService] Error rejecting invitation:', error);
            throw error;
        } finally {
            client.release();
        }
    },

    /**
     * Accept a team invitation or join request notification
     */
    async acceptTeamInvitation(id: string, userEmail?: string) {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            const notifRes = await client.query('SELECT * FROM notifications WHERE id = $1', [id]);
            const notif = notifRes.rows[0];
            if (!notif) {
                throw new Error('Notification not found.');
            }

            if (notif.message.includes('team invitation')) {
                if (!userEmail) {
                    throw new Error('User email is required to accept invitation.');
                }
                const match = notif.message.match(/\[TeamID:([a-fA-F0-9-]+)\]/);
                if (!match) {
                    const res = await client.query(
                        "UPDATE notifications SET action_status = 'accepted', is_read = true WHERE id = $1 RETURNING *",
                        [id]
                    );
                    await client.query('COMMIT');
                    return res.rows[0];
                }
                const teamId = match[1];

                // Find user ID
                const userRes = await client.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [userEmail]);
                const user = userRes.rows[0];
                if (!user) throw new Error('User not found.');

                // Check if user profile is completed (name, student_id, batch_session)
                const profileRes = await client.query('SELECT name, student_id, batch_session FROM user_info WHERE user_id = $1', [user.id]);
                const profile = profileRes.rows[0];
                if (!profile || !profile.name || !profile.student_id || !profile.batch_session) {
                    throw new Error('Please fill up your profile information (Name, Student ID, and Batch/Session) before joining a team.');
                }

                // Check if team is declared full
                const teamCheckRes = await client.query('SELECT is_full FROM teams WHERE id = $1', [teamId]);
                if (teamCheckRes.rows[0]?.is_full) {
                    throw new Error('This team is already full. You cannot accept this invitation.');
                }

                // Check if user already in a team
                const existing = await client.query('SELECT team_id FROM team_members WHERE user_id = $1', [user.id]);
                if (existing.rows.length > 0) {
                    throw new Error('You are already a member of a team.');
                }

                // Check max members
                const countRes = await client.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1', [teamId]);
                const count = parseInt(countRes.rows[0].count, 10);
                const maxRes = await client.query("SELECT value FROM platform_settings WHERE key = 'max_team_members'");
                const maxVal = maxRes.rows[0]?.value;
                const maxMembers = maxVal && maxVal !== 'none' && maxVal !== '' && !isNaN(parseInt(maxVal, 10)) ? parseInt(maxVal, 10) : null;
                if (maxMembers !== null && count >= maxMembers) {
                    throw new Error('This team is already full. You cannot accept this invitation.');
                }

                // Add to team
                await client.query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)', [teamId, user.id]);

                // Notify leader
                const leaderRes = await client.query(
                    'SELECT t.name, u.email FROM teams t JOIN users u ON t.leader_id = u.id WHERE t.id = $1',
                    [teamId]
                );
                if (leaderRes.rows[0]) {
                    await client.query(
                        'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                        [leaderRes.rows[0].email, `${user.email} has accepted your invitation and joined team "${leaderRes.rows[0].name}"!`]
                    );
                }
                const res = await client.query(
                    "UPDATE notifications SET action_status = 'accepted', is_read = true WHERE id = $1 RETURNING *",
                    [id]
                );
                
                // Invalidate the invitation in the team_invitations table so it is no longer pending
                await client.query(
                    'UPDATE team_invitations SET is_used = true WHERE LOWER(email) = LOWER($1) AND team_id = $2 AND is_used = false',
                    [userEmail, teamId]
                );

                await client.query('COMMIT');
                return res.rows[0];
            } else if (notif.message.includes('requested to join your team')) {
                const match = notif.message.match(/\[ReqID:([a-fA-F0-9-]+)\]/);
                if (!match) throw new Error('Invalid join request notification format.');
                const reqId = match[1];

                const reqRes = await client.query('SELECT * FROM team_join_requests WHERE id = $1 AND status = $2', [reqId, 'pending']);
                const joinReq = reqRes.rows[0];
                if (!joinReq) {
                    throw new Error('Join request is no longer pending or does not exist.');
                }

                // Check if user already in a team
                const existing = await client.query('SELECT team_id FROM team_members WHERE user_id = $1', [joinReq.user_id]);
                if (existing.rows.length > 0) {
                    throw new Error('User has already joined another team.');
                }

                // Check if team is declared full & check max members
                const teamCheckRes = await client.query('SELECT is_full FROM teams WHERE id = $1', [joinReq.team_id]);
                if (teamCheckRes.rows[0]?.is_full) {
                    throw new Error('Your team has been declared full. Please reopen your team before accepting join requests.');
                }

                const countRes = await client.query('SELECT COUNT(*) as count FROM team_members WHERE team_id = $1', [joinReq.team_id]);
                const count = parseInt(countRes.rows[0].count, 10);
                const maxRes = await client.query("SELECT value FROM platform_settings WHERE key = 'max_team_members'");
                const maxVal = maxRes.rows[0]?.value;
                const maxMembers = maxVal && maxVal !== 'none' && maxVal !== '' && !isNaN(parseInt(maxVal, 10)) ? parseInt(maxVal, 10) : null;
                if (maxMembers !== null && count >= maxMembers) {
                    throw new Error(`Your team has reached the maximum limit of ${maxMembers} members.`);
                }

                // Add member
                await client.query('INSERT INTO team_members (team_id, user_id) VALUES ($1, $2)', [joinReq.team_id, joinReq.user_id]);
                await client.query("UPDATE team_join_requests SET status = 'accepted' WHERE id = $1", [reqId]);

                // Notify joining user
                const userRes = await client.query('SELECT email FROM users WHERE id = $1', [joinReq.user_id]);
                const teamRes = await client.query('SELECT name FROM teams WHERE id = $1', [joinReq.team_id]);
                if (userRes.rows[0] && teamRes.rows[0]) {
                    await client.query(
                        'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                        [userRes.rows[0].email, `Your request to join team "${teamRes.rows[0].name}" has been ACCEPTED!`]
                    );
                }

                const res = await client.query(
                    "UPDATE notifications SET action_status = 'accepted', is_read = true WHERE id = $1 RETURNING *",
                    [id]
                );
                await client.query('COMMIT');
                return res.rows[0];
            } else if (notif.message.includes('invited to mentor the team')) {
                const userEmailToUse = userEmail;
                if (!userEmailToUse) throw new Error('User email is required.');
                const userRes = await client.query('SELECT id, email, role FROM users WHERE LOWER(email) = LOWER($1)', [userEmailToUse]);
                const user = userRes.rows[0];
                if (!user || user.role !== 'mentor') throw new Error('Mentor not found or invalid role.');

                const match = notif.message.match(/invited to mentor the team "([^"]+)"/);
                if (!match) throw new Error('Invalid mentor invitation format.');
                const teamName = match[1];

                const invRes = await client.query(`
                    SELECT mi.id, mi.team_id, t.mentor_id, t.leader_id 
                    FROM mentor_invitations mi
                    JOIN teams t ON mi.team_id = t.id
                    WHERE mi.mentor_id = $1 AND t.name = $2 AND mi.status = 'pending'
                `, [user.id, teamName]);
                const inv = invRes.rows[0];

                if (!inv) {
                     await client.query("UPDATE notifications SET action_status = 'expired', is_read = true WHERE id = $1", [id]);
                     throw new Error('Invitation is no longer pending or does not exist.');
                }

                if (inv.mentor_id) {
                     await client.query("UPDATE mentor_invitations SET status = 'rejected' WHERE id = $1", [inv.id]);
                     await client.query("UPDATE notifications SET action_status = 'expired', is_read = true WHERE id = $1", [id]);
                     throw new Error('Team already has a mentor.');
                }

                const countRes = await client.query('SELECT COUNT(*) as count FROM teams WHERE mentor_id = $1', [user.id]);
                const currentCount = parseInt(countRes.rows[0].count, 10);
                
                const limitRes = await client.query("SELECT value FROM platform_settings WHERE key = 'max_teams_per_mentor'");
                let maxTeams = 3;
                if (limitRes.rows.length > 0 && limitRes.rows[0].value !== 'none' && !isNaN(parseInt(limitRes.rows[0].value, 10))) {
                    maxTeams = parseInt(limitRes.rows[0].value, 10);
                }

                if (currentCount >= maxTeams) {
                    throw new Error(`You cannot mentor more than ${maxTeams} teams`);
                }

                await client.query('UPDATE teams SET mentor_id = $1 WHERE id = $2', [user.id, inv.team_id]);
                await client.query("UPDATE mentor_invitations SET status = 'accepted' WHERE id = $1", [inv.id]);
                await client.query("UPDATE mentor_invitations SET status = 'rejected' WHERE team_id = $1 AND status = 'pending'", [inv.team_id]);

                const leaderRes = await client.query('SELECT email FROM users WHERE id = $1', [inv.leader_id]);
                if (leaderRes.rows[0]) {
                    const mentorUserRes = await client.query('SELECT COALESCE(ui.name, u.email) as name FROM users u LEFT JOIN user_info ui ON u.id = ui.user_id WHERE u.id = $1', [user.id]);
                    const mentorName = mentorUserRes.rows[0]?.name || 'A mentor';
                    await client.query('INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)', [leaderRes.rows[0].email, `${mentorName} has accepted your invitation to mentor "${teamName}"`]);
                }

                const res = await client.query("UPDATE notifications SET action_status = 'accepted', is_read = true WHERE id = $1 RETURNING *", [id]);
                await client.query('COMMIT');
                return res.rows[0];
            } else {
                const res = await client.query(
                    "UPDATE notifications SET action_status = 'accepted', is_read = true WHERE id = $1 RETURNING *",
                    [id]
                );
                await client.query('COMMIT');
                return res.rows[0];
            }
        } catch (error) {
            await client.query('ROLLBACK');
            console.error('[NotificationService] Error accepting invitation:', error);
            throw error;
        } finally {
            client.release();
        }
    }
};

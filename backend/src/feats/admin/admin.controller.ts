import { Request, Response } from 'express';
import { pool } from '../../config/db.config';
import { CustomError } from '../../error/customErrors';
import { sanitizeAdminTeamUpdate, sanitizeAdminMemberUpdate } from './admin.sanitizer';

/**
 * GET /api/v1/admin/stats
 * Get overview statistics for Admin Dashboard
 */
export const getStats = async (req: Request, res: Response) => {
    try {
        const [usersCountRes, teamsCountRes, settingsRes] = await Promise.all([
            pool.query("SELECT role, COUNT(*) FROM users GROUP BY role"),
            pool.query('SELECT COUNT(*) FROM teams'),
            pool.query('SELECT key, value FROM platform_settings')
        ]);

        const settingsMap: Record<string, string> = {};
        settingsRes.rows.forEach(r => {
            settingsMap[r.key] = r.value;
        });

        let totalUsers = 0, totalAdmins = 0, totalMentors = 0, totalStudents = 0;
        usersCountRes.rows.forEach(r => {
            const count = parseInt(r.count, 10) || 0;
            totalUsers += count;
            if (r.role === 'admin') totalAdmins = count;
            if (r.role === 'mentor') totalMentors = count;
            if (r.role === 'student') totalStudents = count;
        });

        res.status(200).json({
            status: 'success',
            success: true,
            data: {
                totalUsers,
                totalAdmins,
                totalMentors,
                totalStudents,
                totalTeams: parseInt(teamsCountRes.rows[0].count, 10) || 0,
                settings: settingsMap
            }
        });
    } catch (error) {
        console.error('Error fetching admin stats:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to load statistics' });
    }
};

/**
 * GET /api/v1/admin/teams
 * Get all teams with leader and member details
 */
export const getAllTeams = async (req: Request, res: Response) => {
    try {
        const query = `
            SELECT 
                t.id,
                t.name,
                t.leader_id,
                t.created_at,
                t.is_banned,
                t.ban_reason,
                t.mentor_id,
                t.is_submitted,
                t.submitted_at,
                u.email as leader_email,
                ui.name as leader_name,
                ui.avatar_url as leader_avatar_url,
                m.email as mentor_email,
                mi.name as mentor_name,
                mi.avatar_url as mentor_avatar_url,
                mi.student_id as mentor_student_id,
                mi.batch_session as mentor_batch_session,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', m_user.id,
                                'email', m_user.email,
                                'role', m_user.role,
                                'name', COALESCE(m_info.name, ''),
                                'avatar_url', m_info.avatar_url,
                                'student_id', COALESCE(m_info.student_id, ''),
                                'batch_session', COALESCE(m_info.batch_session, ''),
                                'phone_number', COALESCE(m_info.phone_number, '')
                            )
                        )
                        FROM team_members tm
                        JOIN users m_user ON tm.user_id = m_user.id
                        LEFT JOIN user_info m_info ON m_user.id = m_info.user_id
                        WHERE tm.team_id = t.id
                    ),
                    '[]'::json
                ) as members
            FROM teams t
            LEFT JOIN users u ON t.leader_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            LEFT JOIN users m ON t.mentor_id = m.id
            LEFT JOIN user_info mi ON m.id = mi.user_id
            ORDER BY t.created_at DESC
        `;
        const result = await pool.query(query);

        res.status(200).json({
            status: 'success',
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching admin teams:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to load teams' });
    }
};

/**
 * PATCH /api/v1/admin/teams/:id
 * Edit team name, ban or unban team
 */
export const updateTeam = async (req: Request, res: Response) => {
    const { id } = req.params;
    const sanitized = sanitizeAdminTeamUpdate(req.body);
    const { name } = sanitized;
    const { is_banned, ban_reason } = req.body;

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const query = `
                UPDATE teams
                SET 
                    name = COALESCE($1, name),
                    is_banned = COALESCE($2, is_banned),
                    ban_reason = $3
                WHERE id = $4
                RETURNING *
            `;
            const result = await client.query(query, [
                name !== undefined ? name : null,
                is_banned !== undefined ? is_banned : null,
                ban_reason !== undefined ? ban_reason : null,
                id
            ]);

            if (result.rows.length === 0) {
                throw new CustomError('Team not found', 404);
            }

            // Option A: Automatically ban/unban all members when team is banned/unbanned
            if (is_banned === true) {
                await client.query(`
                    UPDATE users 
                    SET is_banned = true, ban_reason = COALESCE($1, 'Your team has been banned.')
                    WHERE id IN (SELECT user_id FROM team_members WHERE team_id = $2)
                `, [ban_reason !== undefined ? ban_reason : null, id]);
            } else if (is_banned === false) {
                await client.query(`
                    UPDATE users 
                    SET is_banned = false, ban_reason = null
                    WHERE id IN (SELECT user_id FROM team_members WHERE team_id = $1)
                `, [id]);
            }

            await client.query('COMMIT');

            if (is_banned !== undefined) {
                const members = await pool.query('SELECT user_id FROM team_members WHERE team_id = $1', [id]);
                const userIds = members.rows.map(m => m.user_id);
                if (userIds.length > 0) {
                    req.app.locals.io?.emit('usersBanUpdated', {
                        userIds,
                        isBanned: is_banned,
                        banReason: is_banned ? (ban_reason || 'Your team has been banned.') : null
                    });
                }
            }

            req.app.locals.io?.emit('statsUpdated');

            res.status(200).json({
                status: 'success',
                success: true,
                data: result.rows[0],
                message: 'Team updated successfully'
            });
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    } catch (error: any) {
        console.error('Error updating team:', error);
        res.status(error.statusCode || 500).json({
            status: 'error',
            success: false,
            message: error.message || 'Failed to update team'
        });
    }
};

/**
 * DELETE /api/v1/admin/messages/:id
 * Delete a sent admin message and recall it from all recipients
 */
export const deleteAdminMessage = async (req: Request, res: Response) => {
    const client = await pool.connect();
    try {
        const { id } = req.params;
        
        await client.query('BEGIN');
        
        // Delete all notifications sent to users corresponding to this broadcast
        await client.query('DELETE FROM notifications WHERE admin_message_id = $1', [id]);
        
        // Delete the message from the admin history
        const deleteRes = await client.query('DELETE FROM admin_messages WHERE id = $1 RETURNING id', [id]);
        
        if (deleteRes.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ status: 'error', success: false, message: 'Message not found' });
        }
        
        await client.query('COMMIT');
        
        req.app.locals.io?.emit('newAdminMessage');

        res.status(200).json({
            status: 'success',
            success: true,
            message: 'Message deleted and successfully recalled from all recipients.'
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Error deleting admin message:', error);
        res.status(500).json({
            status: 'error',
            success: false,
            message: 'Failed to delete admin message'
        });
    } finally {
        client.release();
    }
};

/**
 * DELETE /api/v1/admin/teams/:id
 * Delete a team permanently
 */
export const deleteTeam = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM teams WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            throw new CustomError('Team not found', 404);
        }

        req.app.locals.io?.emit('statsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            message: 'Team deleted successfully'
        });
    } catch (error: any) {
        console.error('Error deleting team:', error);
        res.status(error.statusCode || 500).json({
            status: 'error',
            success: false,
            message: error.message || 'Failed to delete team'
        });
    }
};

/**
 * GET /api/v1/admin/members
 * Get all registered members with profile info and team
 */
export const getAllMembers = async (req: Request, res: Response) => {
    try {
        const query = `
            SELECT 
                u.id,
                u.email,
                u.role,
                u.created_at,
                u.is_banned,
                u.ban_reason,
                ui.avatar_url,
                COALESCE(ui.name, '') as name,
                COALESCE(ui.student_id, '') as student_id,
                COALESCE(ui.batch_session, '') as batch_session,
                COALESCE(ui.phone_number, '') as phone_number,
                t.name as team_name,
                t.id as team_id,
                (
                    SELECT json_agg(json_build_object('id', mt.id, 'name', mt.name))
                    FROM teams mt
                    WHERE mt.mentor_id = u.id
                ) as mentor_teams
            FROM users u
            LEFT JOIN user_info ui ON u.id = ui.user_id
            LEFT JOIN team_members tm ON u.id = tm.user_id
            LEFT JOIN teams t ON tm.team_id = t.id
            ORDER BY u.created_at DESC
        `;
        const result = await pool.query(query);

        res.status(200).json({
            status: 'success',
            success: true,
            data: result.rows
        });
    } catch (error) {
        console.error('Error fetching admin members:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to load registered members' });
    }
};

/**
 * PATCH /api/v1/admin/members/:id
 * Edit member role, profile info, or ban status
 */
export const updateMember = async (req: Request, res: Response) => {
    const { id } = req.params;
    const sanitized = sanitizeAdminMemberUpdate(req.body);
    const { role, is_banned, ban_reason } = req.body;
    const { name, student_id, batch_session, phone_number } = sanitized;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update users table
        const userQuery = `
            UPDATE users
            SET 
                role = COALESCE($1, role),
                is_banned = COALESCE($2, is_banned),
                ban_reason = $3
            WHERE id = $4
            RETURNING *
        `;
        const userRes = await client.query(userQuery, [
            role !== undefined ? role : null,
            is_banned !== undefined ? is_banned : null,
            ban_reason !== undefined ? ban_reason : null,
            id
        ]);

        if (userRes.rows.length === 0) {
            throw new CustomError('User not found', 404);
        }

        // Update user_info table if profile fields provided
        if (name !== undefined || student_id !== undefined || batch_session !== undefined || phone_number !== undefined) {
            const upsertQuery = `
                INSERT INTO user_info (user_id, name, student_id, batch_session, phone_number)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (user_id) DO UPDATE SET
                    name = COALESCE($2, user_info.name),
                    student_id = COALESCE($3, user_info.student_id),
                    batch_session = COALESCE($4, user_info.batch_session),
                    phone_number = COALESCE($5, user_info.phone_number),
                    updated_at = CURRENT_TIMESTAMP
            `;
            await client.query(upsertQuery, [
                id,
                name || null,
                student_id || null,
                batch_session || null,
                phone_number || null
            ]);
        }

        await client.query('COMMIT');

        if (is_banned !== undefined) {
            req.app.locals.io?.emit('usersBanUpdated', {
                userIds: [id],
                isBanned: is_banned,
                banReason: is_banned ? (ban_reason || 'Your account has been banned.') : null
            });
        }

        if (role !== undefined) {
            req.app.locals.io?.to(`user_${id}`).emit('roleUpdated', { role });
        }

        req.app.locals.io?.emit('statsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            data: userRes.rows[0],
            message: 'Member updated successfully'
        });
    } catch (error: any) {
        await client.query('ROLLBACK');
        console.error('Error updating member:', error);
        res.status(error.statusCode || 500).json({
            status: 'error',
            success: false,
            message: error.message || 'Failed to update member'
        });
    } finally {
        client.release();
    }
};

/**
 * DELETE /api/v1/admin/members/:id
 * Delete a user permanently
 */
export const deleteMember = async (req: Request, res: Response) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
        if (result.rows.length === 0) {
            throw new CustomError('User not found', 404);
        }

        req.app.locals.io?.emit('statsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            message: 'Member deleted successfully'
        });
    } catch (error: any) {
        console.error('Error deleting member:', error);
        res.status(error.statusCode || 500).json({
            status: 'error',
            success: false,
            message: error.message || 'Failed to delete member'
        });
    }
};

/**
 * GET /api/v1/admin/settings
 * Get platform settings
 */
export const getSettings = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT key, value FROM platform_settings');
        const settings: Record<string, string> = {};
        result.rows.forEach(r => {
            settings[r.key] = r.value;
        });

        res.status(200).json({
            status: 'success',
            success: true,
            data: settings
        });
    } catch (error) {
        console.error('Error fetching settings:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to load settings' });
    }
};

/**
 * POST /api/v1/admin/settings/toggle-registration
 * Toggle registration_open open/close
 */
export const toggleRegistration = async (req: Request, res: Response) => {
    try {
        const currentRes = await pool.query("SELECT value FROM platform_settings WHERE key = 'registration_open'");
        const currentVal = currentRes.rows.length > 0 ? currentRes.rows[0].value : 'true';
        const newVal = currentVal === 'true' ? 'false' : 'true';

        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('registration_open', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [newVal]
        );
        // Set manual override active
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('reg_override', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'"
        );

        req.app.locals.io?.emit('settingsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            data: { registration_open: newVal, reg_override: 'true' },
            message: `Registration is now ${newVal === 'true' ? 'OPEN' : 'CLOSED'}`
        });
    } catch (error) {
        console.error('Error toggling registration:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to toggle registration' });
    }
};

/**
 * POST /api/v1/admin/settings/toggle-workspace
 * Toggle workspace_open open/close
 */
export const toggleWorkspace = async (req: Request, res: Response) => {
    try {
        const currentRes = await pool.query("SELECT value FROM platform_settings WHERE key = 'workspace_open'");
        const currentVal = currentRes.rows.length > 0 ? currentRes.rows[0].value : 'false';
        const newVal = currentVal === 'true' ? 'false' : 'true';

        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('workspace_open', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [newVal]
        );
        // Set manual override active
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('hack_override', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'"
        );

        req.app.locals.io?.emit('settingsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            data: { workspace_open: newVal, hack_override: 'true' },
            message: `Project Workspace is now ${newVal === 'true' ? 'OPEN' : 'CLOSED'}`
        });
    } catch (error) {
        console.error('Error toggling workspace:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to toggle workspace access' });
    }
};

/**
 * POST /api/v1/admin/settings/toggle-problems
 * Toggle problems_open open/close
 */
export const toggleProblems = async (req: Request, res: Response) => {
    try {
        const currentRes = await pool.query("SELECT value FROM platform_settings WHERE key = 'problems_open'");
        const currentVal = currentRes.rows.length > 0 ? currentRes.rows[0].value : 'false';
        const newVal = currentVal === 'true' ? 'false' : 'true';

        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('problems_open', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [newVal]
        );
        // Set manual override active
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('prob_override', 'true') ON CONFLICT (key) DO UPDATE SET value = 'true'"
        );

        req.app.locals.io?.emit('settingsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            data: { problems_open: newVal, prob_override: 'true' },
            message: `Problem Statements are now ${newVal === 'true' ? 'OPEN' : 'CLOSED'}`
        });
    } catch (error) {
        console.error('Error toggling problems:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to toggle problems access' });
    }
};


/**
 * POST /api/v1/admin/settings/team-limits
 * Update min_team_members and max_team_members
 */
export const updateTeamLimits = async (req: Request, res: Response) => {
    try {
        const { min_team_members, max_team_members, max_teams_per_mentor } = req.body;
        if (min_team_members !== undefined) {
            const val = min_team_members === '' || min_team_members === null || min_team_members === 'none' ? 'none' : String(min_team_members);
            await pool.query(
                "INSERT INTO platform_settings (key, value) VALUES ('min_team_members', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
                [val]
            );
        }
        if (max_team_members !== undefined) {
            const val = max_team_members === '' || max_team_members === null || max_team_members === 'none' ? 'none' : String(max_team_members);
            await pool.query(
                "INSERT INTO platform_settings (key, value) VALUES ('max_team_members', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
                [val]
            );
        }
        if (max_teams_per_mentor !== undefined) {
            const val = max_teams_per_mentor === '' || max_teams_per_mentor === null || max_teams_per_mentor === 'none' ? 'none' : String(max_teams_per_mentor);
            await pool.query(
                "INSERT INTO platform_settings (key, value) VALUES ('max_teams_per_mentor', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
                [val]
            );
        }

        const result = await pool.query('SELECT key, value FROM platform_settings');
        const settings: Record<string, string> = {};
        result.rows.forEach(r => {
            settings[r.key] = r.value;
        });

        req.app.locals.io?.emit('settingsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            data: settings,
            message: 'Team size limits updated successfully'
        });
    } catch (error) {
        console.error('Error updating team limits:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to update team size limits' });
    }
};

/**
 * POST /api/v1/admin/settings/registration-timeline
 * Update reg_start_time and reg_end_time
 */
export const updateRegistrationTimeline = async (req: Request, res: Response) => {
    try {
        const { reg_start_time, reg_end_time } = req.body;
        // Save dates
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('reg_start_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [reg_start_time || '']
        );
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('reg_end_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [reg_end_time || '']
        );
        // Clear manual override since they just set a new automated timeline
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('reg_override', 'false') ON CONFLICT (key) DO UPDATE SET value = 'false'"
        );

        req.app.locals.io?.emit('settingsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            data: { reg_start_time: reg_start_time || '', reg_end_time: reg_end_time || '', reg_override: 'false' },
            message: 'Registration timeline updated successfully'
        });
    } catch (error) {
        console.error('Error updating registration timeline:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to update registration timeline' });
    }
};

/**
 * POST /api/v1/admin/settings/hackathon-timeline
 * Update hack_start_time and hack_end_time
 */
export const updateHackathonTimeline = async (req: Request, res: Response) => {
    try {
        const { hack_start_time, hack_end_time } = req.body;
        // Save dates
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('hack_start_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [hack_start_time || '']
        );
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('hack_end_time', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [hack_end_time || '']
        );
        // Clear manual override since they just set a new automated timeline
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('hack_override', 'false') ON CONFLICT (key) DO UPDATE SET value = 'false'"
        );
        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('prob_override', 'false') ON CONFLICT (key) DO UPDATE SET value = 'false'"
        );

        req.app.locals.io?.emit('settingsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            data: { hack_start_time: hack_start_time || '', hack_end_time: hack_end_time || '', hack_override: 'false', prob_override: 'false' },
            message: 'Hackathon timeline updated successfully'
        });
    } catch (error) {
        console.error('Error updating hackathon timeline:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to update hackathon timeline' });
    }
};

/**
 * DELETE /api/v1/admin/members/bulk-delete
 * Bulk delete members with admin protection
 */
export const deleteMultipleMembers = async (req: Request, res: Response) => {
    try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ status: 'error', success: false, message: 'No members selected' });
        return;
    }
        const result = await pool.query("DELETE FROM users WHERE id = ANY($1) AND role != 'admin' RETURNING id", [ids]);
        
        req.app.locals.io?.emit('statsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            message: `Successfully deleted ${result.rowCount} member(s).`,
            deletedCount: result.rowCount
        });
    } catch (error: any) {
        console.error('Error in bulk delete members:', error);
        res.status(error.statusCode || 500).json({
            status: 'error',
            success: false,
            message: error.message || 'Failed to bulk delete members'
        });
    }
};

/**
 * DELETE /api/v1/admin/teams/bulk-delete
 * Bulk delete teams
 */
export const deleteMultipleTeams = async (req: Request, res: Response) => {
    try {
    const { ids } = req.body;
    
    if (!Array.isArray(ids) || ids.length === 0) {
        res.status(400).json({ status: 'error', success: false, message: 'No teams selected' });
        return;
    }
        const result = await pool.query('DELETE FROM teams WHERE id = ANY($1) RETURNING id', [ids]);
        
        req.app.locals.io?.emit('statsUpdated');

        res.status(200).json({
            status: 'success',
            success: true,
            message: `Successfully deleted ${result.rowCount} team(s).`,
            deletedCount: result.rowCount
        });
    } catch (error: any) {
        console.error('Error in bulk delete teams:', error);
        res.status(error.statusCode || 500).json({
            status: 'error',
            success: false,
            message: error.message || 'Failed to bulk delete teams'
        });
    }
};

/**
 * POST /api/v1/admin/messages/send
 * Broadcast/send notification message to all members, mentors, team leaders, or selected users/teams
 */
export const sendAdminMessage = async (req: Request, res: Response) => {
    try {
        const { targetType, selectedEmails, selectedTeamIds, title, message, severity = 'info' } = req.body;

        if (!message || !message.trim()) {
            return res.status(400).json({ status: 'error', success: false, message: 'Message content is required.' });
        }

        let recipientEmails: string[] = [];

        if (targetType === 'all') {
            const resAll = await pool.query("SELECT DISTINCT email FROM users WHERE role != 'admin' AND email IS NOT NULL AND email != ''");
            recipientEmails = resAll.rows.map(r => r.email);
        } else if (targetType === 'team_leaders') {
            const resLeaders = await pool.query(
                "SELECT DISTINCT u.email FROM teams t JOIN users u ON t.leader_id = u.id WHERE u.email IS NOT NULL AND u.email != ''"
            );
            recipientEmails = resLeaders.rows.map(r => r.email);
        } else if (targetType === 'mentors') {
            const resMentors = await pool.query(
                "SELECT DISTINCT email FROM users WHERE role = 'mentor' AND email IS NOT NULL AND email != ''"
            );
            recipientEmails = resMentors.rows.map(r => r.email);
        } else if (targetType === 'selected') {
            if (!Array.isArray(selectedEmails) || selectedEmails.length === 0) {
                return res.status(400).json({ status: 'error', success: false, message: 'Please select at least one recipient.' });
            }
            recipientEmails = [...new Set(selectedEmails.filter(Boolean))];
        } else if (targetType === 'teams') {
            if (!Array.isArray(selectedTeamIds) || selectedTeamIds.length === 0) {
                return res.status(400).json({ status: 'error', success: false, message: 'Please select at least one team.' });
            }
            const resTeams = await pool.query(
                `SELECT DISTINCT u.email 
                 FROM users u 
                 LEFT JOIN team_members tm ON u.id = tm.user_id 
                 LEFT JOIN teams t ON (t.leader_id = u.id OR t.mentor_id = u.id OR tm.team_id = t.id)
                 WHERE t.id = ANY($1::uuid[]) AND u.email IS NOT NULL AND u.email != ''`,
                [selectedTeamIds]
            );
            recipientEmails = resTeams.rows.map(r => r.email);
        } else {
            return res.status(400).json({ status: 'error', success: false, message: 'Invalid target type.' });
        }

        if (recipientEmails.length === 0) {
            return res.status(404).json({ status: 'error', success: false, message: 'No recipients found for the selected target group.' });
        }

        let prefix = '📢 [Admin Message]';
        if (severity === 'urgent') prefix = '🚨 [URGENT Broadcast]';
        else if (severity === 'warning') prefix = '⚠️ [Important Notice]';

        const formattedMessage = `${prefix} ${title && title.trim() ? title.trim() + ' — ' : ''}${message.trim()}`;

        const adminMsgRes = await pool.query(
            'INSERT INTO admin_messages (title, message, target_type, severity) VALUES ($1, $2, $3, $4) RETURNING id',
            [title || '', message.trim(), targetType, severity]
        );
        const adminMessageId = adminMsgRes.rows[0].id;

        const insertPromises = recipientEmails.map(email =>
            pool.query(
                'INSERT INTO notifications (recipient_email, message, action_status, admin_message_id) VALUES ($1, $2, $3, $4)',
                [email, formattedMessage, severity, adminMessageId]
            )
        );

        await Promise.all(insertPromises);

        req.app.locals.io?.emit('newAdminMessage');

        res.status(200).json({
            status: 'success',
            success: true,
            message: `Message sent to ${recipientEmails.length} recipient(s).`,
            recipientsCount: recipientEmails.length
        });
    } catch (error: any) {
        console.error('Error sending admin broadcast message:', error);
        res.status(500).json({
            status: 'error',
            success: false,
            message: error.message || 'Failed to send message.'
        });
    }
};

export const getAdminMessageHistory = async (req: Request, res: Response) => {
    try {
        const result = await pool.query('SELECT * FROM admin_messages ORDER BY created_at DESC');
        res.status(200).json({ success: true, status: 'success', data: result.rows });
    } catch (error: any) {
        console.error('Error fetching admin messages:', error);
        res.status(500).json({ success: false, status: 'error', message: error.message || 'Failed to fetch history' });
    }
};

export const updateAdminMessage = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { title, message, severity = 'info' } = req.body;
        
        if (!message || !message.trim()) {
            return res.status(400).json({ status: 'error', success: false, message: 'Message content is required.' });
        }
        
        await pool.query(
            'UPDATE admin_messages SET title = $1, message = $2, severity = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4',
            [title || '', message.trim(), severity, id]
        );
        
        let prefix = '📢 [Admin Message]';
        if (severity === 'urgent') prefix = '🚨 [URGENT Broadcast]';
        else if (severity === 'warning') prefix = '⚠️ [Important Notice]';
        
        const formattedMessage = `${prefix} ${title && title.trim() ? title.trim() + ' — ' : ''}${message.trim()}`;
        
        await pool.query(
            'UPDATE notifications SET message = $1, action_status = $2 WHERE admin_message_id = $3',
            [formattedMessage, severity, id]
        );
        
        res.status(200).json({ success: true, status: 'success', message: 'Message updated successfully.' });
    } catch (error: any) {
        console.error('Error updating admin message:', error);
        res.status(500).json({ success: false, status: 'error', message: error.message || 'Failed to update message' });
    }
};


export const getAllSubmissions = async (req: Request, res: Response): Promise<void> => {
    try {
        const query = `
            SELECT 
                t.id,
                t.name,
                t.leader_id,
                t.created_at,
                t.mentor_id,
                t.repo_url,
                t.live_url,
                t.video_url,
                t.submitted_at,
                u.email as leader_email,
                ui.name as leader_name,
                m.email as mentor_email,
                mi.name as mentor_name,
                COALESCE(
                    (
                        SELECT json_agg(
                            json_build_object(
                                'id', m_user.id,
                                'email', m_user.email,
                                'role', m_user.role,
                                'name', COALESCE(m_info.name, ''),
                                'student_id', COALESCE(m_info.student_id, ''),
                                'batch_session', COALESCE(m_info.batch_session, ''),
                                'phone_number', COALESCE(m_info.phone_number, '')
                            )
                        )
                        FROM team_members tm
                        JOIN users m_user ON tm.user_id = m_user.id
                        LEFT JOIN user_info m_info ON m_user.id = m_info.user_id
                        WHERE tm.team_id = t.id
                    ),
                    '[]'::json
                ) as members
            FROM teams t
            LEFT JOIN users u ON t.leader_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            LEFT JOIN users m ON t.mentor_id = m.id
            LEFT JOIN user_info mi ON m.id = mi.user_id
            WHERE t.is_submitted = true
            ORDER BY t.submitted_at DESC
        `;
        const result = await pool.query(query);

        res.status(200).json({
            status: 'success',
            success: true,
            data: result.rows
        });
    } catch (error: any) {
        console.error('[AdminController] Error fetching submissions:', error);
        res.status(500).json({
            status: 'error',
            success: false,
            message: 'Internal server error while fetching submissions'
        });
    }
};

/**
 * POST /api/v1/admin/settings/toggle-feedback
 * Toggle feedback_open open/close
 */
export const toggleFeedback = async (req: Request, res: Response) => {
    try {
        const currentRes = await pool.query("SELECT value FROM platform_settings WHERE key = 'feedback_open'");
        // Default to 'true' if not set, so the first toggle makes it 'false'
        const currentVal = currentRes.rows.length > 0 ? currentRes.rows[0].value : 'true';
        const newVal = currentVal === 'true' ? 'false' : 'true';

        await pool.query(
            "INSERT INTO platform_settings (key, value) VALUES ('feedback_open', $1) ON CONFLICT (key) DO UPDATE SET value = $1",
            [newVal]
        );

        res.status(200).json({
            status: 'success',
            success: true,
            data: { feedback_open: newVal },
            message: `Feedback is now ${newVal === 'true' ? 'VISIBLE' : 'HIDDEN'}`
        });
    } catch (error) {
        console.error('Error toggling feedback:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to toggle feedback access' });
    }
};

/**
 * POST /api/v1/admin/submissions/:teamId/cancel
 * Cancels a team's submission
 */
export const rejectSubmission = async (req: Request, res: Response): Promise<void> => {
    const { teamId } = req.params;
    const { reason } = req.body;
    try {
        const teamResult = await pool.query(`
            SELECT t.id, t.name, t.leader_id, u.email as leader_email 
            FROM teams t 
            JOIN users u ON t.leader_id = u.id 
            WHERE t.id = $1
        `, [teamId]);

        if (teamResult.rowCount === 0) {
            res.status(404).json({
                status: 'error',
                success: false,
                message: 'Team not found'
            });
            return;
        }

        const team = teamResult.rows[0];

        await pool.query(`
            UPDATE teams
            SET is_submitted = false, submitted_at = NULL, repo_url = NULL, live_url = NULL, video_url = NULL
            WHERE id = $1
        `, [teamId]);

        let msg = "The required submissions you made, has been rejected by the admin";
        if (reason && reason.trim() !== '') {
            msg += `. Reason: ${reason.trim()}`;
        }

        if (team.leader_email) {
            await pool.query(
                'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                [team.leader_email, msg]
            );
        }

        res.status(200).json({
            status: 'success',
            success: true,
            message: `Submission for team ${team.name} has been rejected.`
        });
    } catch (error: any) {
        console.error('[AdminController] Error rejecting submission:', error);
        res.status(500).json({
            status: 'error',
            success: false,
            message: 'Internal server error while rejecting submission'
        });
    }
};

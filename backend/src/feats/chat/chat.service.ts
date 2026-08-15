import { pool } from '../../config/db.config';

export const chatService = {
    /**
     * Verify if a user belongs to a team or is its mentor.
     */
    async verifyChatAccess(userId: string, teamId: string): Promise<boolean> {
        // Check if user is the mentor
        const teamRes = await pool.query('SELECT id FROM teams WHERE id = $1 AND mentor_id = $2', [teamId, userId]);
        if (teamRes.rows.length > 0) return true;

        // Check if user is a member
        const memberRes = await pool.query('SELECT team_id FROM team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
        return memberRes.rows.length > 0;
    },

    /**
     * Get chat messages for a specific team.
     */
    async getTeamMessages(teamId: string, limit: number = 50, offset: number = 0) {
        const query = `
            SELECT 
                cm.id,
                cm.team_id,
                cm.sender_id,
                cm.message,
                cm.image_url,
                cm.created_at,
                u.role as sender_role,
                COALESCE(ui.name, u.email) as sender_name,
                ui.avatar_url as sender_avatar
            FROM team_chat_messages cm
            LEFT JOIN users u ON cm.sender_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            WHERE cm.team_id = $1
            ORDER BY cm.created_at DESC
            LIMIT $2 OFFSET $3
        `;
        const res = await pool.query(query, [teamId, limit, offset]);
        // Return in chronological order for UI
        return res.rows.reverse();
    },

    /**
     * Send a new message to a team chat.
     */
    async sendMessage(teamId: string, senderId: string, message: string, imageUrl: string | null = null) {
        const query = `
            WITH inserted AS (
                INSERT INTO team_chat_messages (team_id, sender_id, message, image_url)
                VALUES ($1, $2, $3, $4)
                RETURNING *
            )
            SELECT 
                i.id,
                i.team_id,
                i.sender_id,
                i.message,
                i.image_url,
                i.created_at,
                u.role as sender_role,
                COALESCE(ui.name, u.email) as sender_name,
                ui.avatar_url as sender_avatar
            FROM inserted i
            LEFT JOIN users u ON i.sender_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
        `;
        
        const res = await pool.query(query, [teamId, senderId, message, imageUrl]);
        return res.rows[0];
    },

    /**
     * Get unread message counts for all teams a user is part of (as member or mentor)
     */
    async getUnreadCounts(userId: string) {
        // We find teams the user is associated with.
        // For each team, we count messages where created_at > their last_read_at in team_chat_reads.
        const query = `
            WITH user_teams AS (
                SELECT id as team_id FROM teams WHERE mentor_id = $1
                UNION
                SELECT team_id FROM team_members WHERE user_id = $1
            )
            SELECT 
                ut.team_id,
                COUNT(cm.id)::int as unread_count
            FROM user_teams ut
            LEFT JOIN team_chat_reads tcr ON tcr.team_id = ut.team_id AND tcr.user_id = $1
            LEFT JOIN team_chat_messages cm ON cm.team_id = ut.team_id AND cm.created_at > COALESCE(tcr.last_read_at, '1970-01-01'::timestamp)
            GROUP BY ut.team_id
        `;
        const res = await pool.query(query, [userId]);
        
        let total = 0;
        const teams: Record<string, number> = {};
        
        for (const row of res.rows) {
            if (row.unread_count > 0) {
                total += row.unread_count;
                teams[row.team_id] = row.unread_count;
            }
        }
        
        return { total, teams };
    },

    /**
     * Mark a team's chat as read for a specific user
     */
    async markAsRead(userId: string, teamId: string) {
        const query = `
            INSERT INTO team_chat_reads (user_id, team_id, last_read_at)
            VALUES ($1, $2, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, team_id) 
            DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
        `;
        await pool.query(query, [userId, teamId]);
    },

    /**
     * Get all users in a team (mentor + members) to notify them
     */
    async getTeamUserIds(teamId: string): Promise<string[]> {
        const query = `
            SELECT mentor_id as user_id FROM teams WHERE id = $1 AND mentor_id IS NOT NULL
            UNION
            SELECT user_id FROM team_members WHERE team_id = $1
        `;
        const res = await pool.query(query, [teamId]);
        return res.rows.map(row => row.user_id);
    },

    /**
     * Get committee chat messages.
     */
    async getCommitteeMessages(limit: number = 50, offset: number = 0) {
        const query = `
            SELECT 
                cm.id,
                cm.sender_id,
                cm.message,
                cm.image_url,
                cm.created_at,
                u.role as sender_role,
                COALESCE(ui.name, u.email) as sender_name,
                ui.avatar_url as sender_avatar
            FROM committee_chat_messages cm
            LEFT JOIN users u ON cm.sender_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            ORDER BY cm.created_at DESC
            LIMIT $1 OFFSET $2
        `;
        const res = await pool.query(query, [limit, offset]);
        return res.rows.reverse();
    },

    /**
     * Send a new message to the committee chat.
     */
    async sendCommitteeMessage(senderId: string, message: string, imageUrl: string | null = null) {
        const query = `
            WITH inserted AS (
                INSERT INTO committee_chat_messages (sender_id, message, image_url)
                VALUES ($1, $2, $3)
                RETURNING *
            )
            SELECT 
                i.id,
                i.sender_id,
                i.message,
                i.image_url,
                i.created_at,
                u.role as sender_role,
                COALESCE(ui.name, u.email) as sender_name,
                ui.avatar_url as sender_avatar
            FROM inserted i
            LEFT JOIN users u ON i.sender_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
        `;
        
        const res = await pool.query(query, [senderId, message, imageUrl]);
        return res.rows[0];
    },

    /**
     * Get unread message count for committee chat for a specific user
     */
    async getCommitteeUnreadCount(userId: string) {
        const query = `
            SELECT COUNT(cm.id)::int as unread_count
            FROM committee_chat_messages cm
            LEFT JOIN committee_chat_reads tcr ON tcr.user_id = $1
            WHERE cm.created_at > COALESCE(tcr.last_read_at, '1970-01-01'::timestamp)
        `;
        const res = await pool.query(query, [userId]);
        return res.rows[0]?.unread_count || 0;
    },

    /**
     * Mark committee chat as read for a specific user
     */
    async markCommitteeAsRead(userId: string) {
        const query = `
            INSERT INTO committee_chat_reads (user_id, last_read_at)
            VALUES ($1, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id) 
            DO UPDATE SET last_read_at = CURRENT_TIMESTAMP
        `;
        await pool.query(query, [userId]);
    },

    /**
     * Get all users in the committee (admin + mentor) to notify them
     */
    async getCommitteeUserIds(): Promise<string[]> {
        const query = `
            SELECT id as user_id FROM users WHERE role IN ('admin', 'mentor')
        `;
        const res = await pool.query(query);
        return res.rows.map(row => row.user_id);
    }
};

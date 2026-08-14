import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../../config/db.config';
import { CustomError } from '../../error/customErrors';
import { generateToken } from '../../config/jwt.config';
import { User } from './user.model';

export const registerUser = async (userData: any): Promise<User> => {
    const { email, password, role, name, student_id, batch_session } = userData;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 0. Check if registration is open and within timeline
        const settingsRes = await client.query("SELECT key, value FROM platform_settings WHERE key IN ('registration_open', 'reg_start_time', 'reg_end_time', 'reg_override')");
        const settings = settingsRes.rows.reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>);
        
        let isRegOpen = settings.registration_open !== 'false';
        const override = settings.reg_override === 'true';
        const startTime = settings.reg_start_time;
        const endTime = settings.reg_end_time;
        const now = new Date();

        if (override) {
            isRegOpen = settings.registration_open !== 'false';
        } else if (startTime && endTime) {
            isRegOpen = now >= new Date(startTime) && now <= new Date(endTime);
        } else if (startTime) {
            isRegOpen = now >= new Date(startTime);
        } else if (endTime) {
            isRegOpen = now <= new Date(endTime);
        }

        if (!isRegOpen) {
            throw new CustomError('Registration is currently closed by administration.', 403);
        }

        // 1. Check if user already exists
        const existingUser = await client.query('SELECT id FROM users WHERE email = $1', [email]);
        
        if (existingUser.rows.length > 0) {
            throw new CustomError('User with this email already exists', 409);
        }

        // 2. Hash the password
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Generate UUID
        const id = crypto.randomUUID();

        // 4. Insert user
        const query = `
            INSERT INTO users (id, email, password, role) 
            VALUES ($1, $2, $3, $4) 
            RETURNING id, email, role
        `;
        const result = await client.query(query, [id, email, hashedPassword, role]);
        const user = result.rows[0];

        // 5. Insert initial profile data into user_info
        if (name || student_id || batch_session) {
            await client.query(
                `INSERT INTO user_info (user_id, name, student_id, batch_session)
                 VALUES ($1, $2, $3, $4)`,
                [id, name || '', student_id || '', batch_session || '']
            );
        }

        await client.query('COMMIT');
        return {
            ...user,
            profile: {
                name: name || '',
                student_id: student_id || '',
                batch_session: batch_session || '',
                phone_number: ''
            }
        } as any;
    } catch (error: any) {
        await client.query('ROLLBACK');
        if (error instanceof CustomError) throw error;
        console.error('Service Error [registerUser]:', error);
        throw new CustomError('Database operation failed during registration', 500);
    } finally {
        client.release();
    }
};

export const loginUser = async (email: string, password: string) => {
    try {
        // 1. Fetch user by email with user_info in a single JOIN
        const query = `
            SELECT u.*, ui.name, ui.student_id, ui.batch_session, ui.phone_number, ui.avatar_url,
                   t.is_banned as team_is_banned, t.ban_reason as team_ban_reason
            FROM users u
            LEFT JOIN user_info ui ON u.id = ui.user_id
            LEFT JOIN team_members tm ON u.id = tm.user_id
            LEFT JOIN teams t ON tm.team_id = t.id
            WHERE u.email = $1
        `;
        const result = await pool.query(query, [email]);
        const user = result.rows[0];

        // 2. Validate user existence
        if (!user) {
            throw new CustomError('Invalid email or password', 401);
        }

        // 3. Compare passwords
        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            throw new CustomError('Invalid email or password', 401);
        }

        // 4. Generate JWT
        const token = generateToken({ id: user.id, email: user.email, role: user.role });

        const derivedIsBanned = user.is_banned || user.team_is_banned || false;
        const derivedBanReason = user.is_banned 
            ? (user.ban_reason || 'Violation of platform rules.') 
            : (user.team_is_banned ? (user.team_ban_reason || 'Your team has been banned.') : null);

        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                is_banned: derivedIsBanned,
                ban_reason: derivedBanReason,
                profile: {
                    name: user.name || '',
                    student_id: user.student_id || '',
                    batch_session: user.batch_session || '',
                    phone_number: user.phone_number || '',
                    avatar_url: user.avatar_url || ''
                }
            }
        };
    } catch (error: any) {
        if (error instanceof CustomError) throw error;
        
        console.error('Service Error [loginUser]:', error);
        throw new CustomError('Database operation failed during login', 500);
    }
};

export const getMe = async (userId: string, role?: string) => {
    try {
        const userQuery = `
            SELECT u.id, u.email, u.role, u.created_at, u.is_banned, u.ban_reason,
                   ui.name, ui.student_id, ui.batch_session, ui.phone_number, ui.avatar_url,
                   t.id as team_id, t.name as team_name, t.leader_id,
                   t.is_banned as team_is_banned, t.ban_reason as team_ban_reason
            FROM users u
            LEFT JOIN user_info ui ON u.id = ui.user_id
            LEFT JOIN team_members tm ON u.id = tm.user_id
            LEFT JOIN teams t ON tm.team_id = t.id
            WHERE u.id = $1
        `;
        const userResult = await pool.query(userQuery, [userId]);
        const profile = userResult.rows[0];

        if (!profile) {
            throw new CustomError('User not found', 404);
        }

        const derivedIsBanned = profile.is_banned || profile.team_is_banned || false;
        const derivedBanReason = profile.is_banned 
            ? (profile.ban_reason || 'Violation of platform rules.') 
            : (profile.team_is_banned ? (profile.team_ban_reason || 'Your team has been banned.') : null);

        profile.is_banned = derivedIsBanned;
        profile.ban_reason = derivedBanReason;

        return profile;
    } catch (error: any) {
        if (error instanceof CustomError) throw error;
        console.error('Service Error [getMe]:', error);
        throw new CustomError('Failed to fetch user profile', 500);
    }
};
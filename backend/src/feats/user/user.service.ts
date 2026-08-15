import { pool } from '../../config/db.config';
import { CustomError } from '../../error/customErrors';
import cloudinary from '../../config/cloudinary.config';

export interface UserInfo {
    userId: string;
    name: string;
    studentId: string;
    batchSession: string;
    phoneNumber: string;
}

export const getProfile = async (userId: string) => {
    try {
        const result = await pool.query('SELECT * FROM user_info WHERE user_id = $1', [userId]);
        
        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            studentId: row.student_id,
            batchSession: row.batch_session,
            phoneNumber: row.phone_number,
            avatar_url: row.avatar_url
        };
    } catch (error: any) {
        console.error('Service Error [getProfile]:', error);
        throw new CustomError('Failed to fetch user profile', 500);
    }
};

export const upsertProfile = async (data: UserInfo) => {
    try {
        const query = `
            INSERT INTO user_info (user_id, name, student_id, batch_session, phone_number)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (user_id) 
            DO UPDATE SET 
                name = EXCLUDED.name,
                student_id = EXCLUDED.student_id,
                batch_session = EXCLUDED.batch_session,
                phone_number = EXCLUDED.phone_number,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *;
        `;
        
        const result = await pool.query(query, [
            data.userId,
            data.name,
            data.studentId,
            data.batchSession,
            data.phoneNumber
        ]);

        const row = result.rows[0];
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            studentId: row.student_id,
            batchSession: row.batch_session,
            phoneNumber: row.phone_number,
            avatar_url: row.avatar_url
        };
    } catch (error: any) {
        console.error('Service Error [upsertProfile]:', error);
        throw new CustomError('Failed to update user profile', 500);
    }
};

export const searchUsers = async (searchQuery: string) => {
    try {
        const query = `
            SELECT 
                u.id as user_id, 
                u.email, 
                COALESCE(ui.name, '') as name, 
                COALESCE(ui.student_id, '') as student_id,
                ui.avatar_url
            FROM users u
            LEFT JOIN user_info ui ON u.id = ui.user_id
            LEFT JOIN team_members tm ON u.id = tm.user_id
            WHERE 
                u.role NOT IN ('mentor', 'admin')
                AND tm.team_id IS NULL
                AND (u.email ILIKE $1 OR ui.name ILIKE $1 OR ui.student_id ILIKE $1)
            LIMIT 10;
        `;
        const result = await pool.query(query, [`%${searchQuery}%`]);
        return result.rows;
    } catch (error: any) {
        console.error('Service Error [searchUsers]:', error);
        throw new CustomError('Failed to search users', 500);
    }
};

export const uploadAvatarToCloudinary = async (userId: string, file: Express.Multer.File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder: 'hackathon_avatars',
                public_id: `user_${userId}`,
                overwrite: true
            },
            async (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return reject(new CustomError('Failed to upload image to Cloudinary', 500));
                }
                
                if (result && result.secure_url) {
                    try {
                        const query = `
                            INSERT INTO user_info (user_id, avatar_url)
                            VALUES ($1, $2)
                            ON CONFLICT (user_id) 
                            DO UPDATE SET avatar_url = EXCLUDED.avatar_url, updated_at = CURRENT_TIMESTAMP
                            RETURNING avatar_url;
                        `;
                        const dbResult = await pool.query(query, [userId, result.secure_url]);
                        resolve(dbResult.rows[0].avatar_url);
                    } catch (dbErr) {
                        console.error('DB update error after Cloudinary upload:', dbErr);
                        reject(new CustomError('Failed to save avatar URL to database', 500));
                    }
                } else {
                    reject(new CustomError('Cloudinary upload failed (no url returned)', 500));
                }
            }
        );
        uploadStream.end(file.buffer);
    });
};

import { Request, Response } from 'express';
import { pool } from '../../config/db.config';

export const submitFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id || (req as any).user?.userId;
        const { subject, type, description } = req.body;

        if (!userId) {
            res.status(401).json({ success: false, status: 'error', message: 'Unauthorized' });
            return;
        }

        await pool.query(
            'INSERT INTO feedback (user_id, subject, type, description) VALUES ($1, $2, $3, $4)',
            [userId, subject, type, description]
        );

        res.status(201).json({ success: true, status: 'success', message: 'Feedback submitted successfully' });
    } catch (error) {
        console.error('[FeedbackController] Error submitting feedback:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to submit feedback' });
    }
};

export const getAllFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query(`
            SELECT f.*, u.email, COALESCE(ui.name, u.email) as user_name, u.role
            FROM feedback f
            JOIN users u ON f.user_id = u.id
            LEFT JOIN user_info ui ON u.id = ui.user_id
            ORDER BY f.created_at DESC
        `);

        res.status(200).json({ success: true, status: 'success', data: result.rows });
    } catch (error) {
        console.error('[FeedbackController] Error fetching feedback:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to fetch feedback' });
    }
};

export const getUnresolvedFeedbackCount = async (req: Request, res: Response): Promise<void> => {
    try {
        const result = await pool.query("SELECT COUNT(*) as count FROM feedback WHERE status = 'open'");
        res.status(200).json({ success: true, status: 'success', count: parseInt(result.rows[0].count, 10) });
    } catch (error) {
        console.error('[FeedbackController] Error fetching unresolved feedback count:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to fetch count' });
    }
};

export const resolveFeedback = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const result = await pool.query(
            "UPDATE feedback SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING *",
            [id]
        );

        if (result.rows.length === 0) {
            res.status(404).json({ success: false, status: 'error', message: 'Feedback not found' });
            return;
        }

        const resolvedFeedback = result.rows[0];

        // Notify the user if the feedback was not a question
        if (resolvedFeedback.type !== 'question' && resolvedFeedback.user_id) {
            const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [resolvedFeedback.user_id]);
            const userEmail = userRes.rows[0]?.email;
            if (userEmail) {
                const msg = `The issue you submitted as "${resolvedFeedback.subject}", has been resolved by the admin. Please check if you face the same issue again. Thank you.`;
                await pool.query(
                    'INSERT INTO notifications (recipient_email, message) VALUES ($1, $2)',
                    [userEmail, msg]
                );
            }
        }

        res.status(200).json({ success: true, status: 'success', message: 'Feedback resolved successfully', data: resolvedFeedback });
    } catch (error) {
        console.error('[FeedbackController] Error resolving feedback:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Failed to resolve feedback' });
    }
};

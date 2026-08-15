import { Router, Request, Response } from 'express';
import { pool } from '../config/db.config';
import authRoutes from '../feats/auth/auth.routes';
import userRoutes from '../feats/user/user.routes';
import notificationRoutes from '../feats/notification/notification.routes';
import teamRoutes from '../feats/team/team.routes';
import adminRoutes from '../feats/admin/admin.routes';
import problemRoutes from '../feats/problem/problem.routes';
import ruleRoutes from '../feats/rules/rules.routes';
import mentorRoutes from '../feats/mentor/mentor.routes';
import feedbackRoutes from '../feats/feedback/feedback.routes';
import chatRoutes from '../feats/chat/chat.routes';

const router = Router();

/**
 * Public Platform Settings Endpoint
 */
router.get('/settings', async (req: Request, res: Response) => {
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
        console.error('Error fetching public settings:', error);
        res.status(500).json({ status: 'error', success: false, message: 'Failed to load settings' });
    }
});

/**
 * API Route Definition
 * Routes are grouped by their respective feature modules
 */
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/notifications', notificationRoutes);
router.use('/teams', teamRoutes);
router.use('/admin', adminRoutes);
router.use('/problems', problemRoutes);
router.use('/rules', ruleRoutes);
router.use('/mentors', mentorRoutes);
router.use('/feedback', feedbackRoutes);
router.use('/chat', chatRoutes);

export default router;
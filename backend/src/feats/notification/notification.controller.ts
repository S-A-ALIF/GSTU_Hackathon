import { Request, Response } from 'express';
import { notificationService } from './notification.service';
import { pool } from '../../config/db.config';

export const getMyNotifications = async (req: Request, res: Response): Promise<void> => {
    try {
        let targetEmail = (typeof req.query.email === 'string' && req.query.email) || (req as any).user?.email || req.body?.email;

        if (!targetEmail) {
            const userId = (req as any).user?.id || (req as any).user?.userId;
            if (userId) {
                const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
                targetEmail = userRes.rows[0]?.email;
            }
        }

        if (!targetEmail) {
            res.status(400).json({ success: false, status: 'error', message: 'Email is required to fetch notifications' });
            return;
        }

        const skipUpdate = req.query.skipUpdate === 'true';
        const notifications = await notificationService.getNotificationsByEmail(targetEmail, skipUpdate);
        res.status(200).json({ success: true, status: 'success', data: notifications });
    } catch (error: any) {
        console.error('[NotificationController] Error in getMyNotifications:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Internal server error fetching notifications' });
    }
};

export const markNotificationAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ success: false, status: 'error', message: 'Notification ID is required' });
            return;
        }

        await notificationService.markAsRead(id);
        res.status(200).json({ success: true, status: 'success', message: 'Notification marked as read' });
    } catch (error: any) {
        console.error('[NotificationController] Error in markNotificationAsRead:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Internal server error marking notification as read' });
    }
};

export const markAllNotificationsAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        let targetEmail = (typeof req.query.email === 'string' && req.query.email) || (req as any).user?.email || req.body?.email;

        if (!targetEmail) {
            const userId = (req as any).user?.id || (req as any).user?.userId;
            if (userId) {
                const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
                targetEmail = userRes.rows[0]?.email;
            }
        }

        if (!targetEmail) {
            res.status(400).json({ success: false, status: 'error', message: 'User email is required' });
            return;
        }

        await notificationService.markAllAsRead(targetEmail);
        res.status(200).json({ success: true, status: 'success', message: 'All notifications marked as read' });
    } catch (error: any) {
        console.error('[NotificationController] Error in markAllNotificationsAsRead:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Internal server error marking all notifications as read' });
    }
};

export const deleteMyNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        if (!id) {
            res.status(400).json({ success: false, status: 'error', message: 'Notification ID is required' });
            return;
        }

        const deleted = await notificationService.deleteNotification(id);
        if (!deleted) {
            res.status(404).json({ success: false, status: 'error', message: 'Notification not found or already deleted' });
            return;
        }
        res.status(200).json({ success: true, status: 'success', message: 'Notification deleted successfully' });
    } catch (error: any) {
        console.error('[NotificationController] Error in deleteMyNotification:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Internal server error deleting notification' });
    }
};

export const rejectInvitationNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        let targetEmail = (typeof req.query.email === 'string' && req.query.email) || (req as any).user?.email || req.body?.email;

        if (!targetEmail) {
            const userId = (req as any).user?.id || (req as any).user?.userId;
            if (userId) {
                const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
                targetEmail = userRes.rows[0]?.email;
            }
        }

        if (!id || !targetEmail) {
            res.status(400).json({ success: false, status: 'error', message: 'Notification ID and User Email are required' });
            return;
        }

        const updated = await notificationService.rejectTeamInvitation(id, targetEmail);
        req.app.locals.io?.emit('statsUpdated');
        req.app.locals.io?.emit('newAdminMessage');
        res.status(200).json({ success: true, status: 'success', message: 'Invitation rejected and invalidated.', data: updated });
    } catch (error: any) {
        console.error('[NotificationController] Error in rejectInvitationNotification:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Internal server error rejecting invitation' });
    }
};

export const acceptInvitationNotification = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        let targetEmail = (typeof req.query.email === 'string' && req.query.email) || (req as any).user?.email || req.body?.email;

        if (!targetEmail) {
            const userId = (req as any).user?.id || (req as any).user?.userId;
            if (userId) {
                const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
                targetEmail = userRes.rows[0]?.email;
            }
        }

        if (!id || !targetEmail) {
            res.status(400).json({ success: false, status: 'error', message: 'Notification ID and User Email are required' });
            return;
        }

        const updated = await notificationService.acceptTeamInvitation(id, targetEmail);
        req.app.locals.io?.emit('statsUpdated');
        req.app.locals.io?.emit('newAdminMessage');
        res.status(200).json({ success: true, status: 'success', message: 'Invitation accepted.', data: updated });
    } catch (error: any) {
        console.error('[NotificationController] Error in acceptInvitationNotification:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Internal server error accepting invitation' });
    }
};

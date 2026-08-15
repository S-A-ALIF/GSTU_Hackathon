import { Request, Response } from 'express';
import { chatService } from './chat.service';
import cloudinary from '../../config/cloudinary.config';

const uploadImageToCloudinary = (file: Express.Multer.File, folder: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder: folder },
            (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    return reject(new Error('Failed to upload image'));
                }
                if (result && result.secure_url) {
                    resolve(result.secure_url);
                } else {
                    reject(new Error('No secure_url returned'));
                }
            }
        );
        uploadStream.end(file.buffer);
    });
};

export const getTeamMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const { teamId } = req.params;

        const hasAccess = await chatService.verifyChatAccess(userId, teamId);
        if (!hasAccess) {
            res.status(403).json({ success: false, message: 'You do not have access to this team chat.' });
            return;
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const messages = await chatService.getTeamMessages(teamId, limit, offset);
        res.status(200).json({ success: true, data: messages });
    } catch (error: any) {
        console.error('[ChatController] Error fetching messages:', error);
        res.status(500).json({ success: false, message: 'Error fetching messages' });
    }
};

export const sendMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const { teamId } = req.params;
        const { message } = req.body;
        
        if (!message && !req.file) {
            res.status(400).json({ success: false, message: 'Message or image is required' });
            return;
        }

        const hasAccess = await chatService.verifyChatAccess(userId, teamId);
        if (!hasAccess) {
            res.status(403).json({ success: false, message: 'You do not have access to this team chat.' });
            return;
        }
        
        let imageUrl = null;
        if (req.file) {
            imageUrl = await uploadImageToCloudinary(req.file, `hackathon_chat/team_${teamId}`);
        }

        const newMessage = await chatService.sendMessage(teamId, userId, message || '', imageUrl);

        // Emit to socket room
        req.app.locals.io?.to(`team_${teamId}`).emit('newChatMessage', newMessage);

        // Notify individual team members (for global unread badges)
        const teamUsers = await chatService.getTeamUserIds(teamId);
        teamUsers.forEach(id => {
            if (id !== userId) { // Don't notify the sender
                req.app.locals.io?.to(`user_${id}`).emit('unreadMessageUpdate', { team_id: teamId });
            }
        });

        res.status(201).json({ success: true, data: newMessage });
    } catch (error: any) {
        console.error('[ChatController] Error sending message:', error);
        res.status(500).json({ success: false, message: 'Error sending message' });
    }
};

export const getUnreadCounts = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const counts = await chatService.getUnreadCounts(userId);
        res.status(200).json({ success: true, data: counts });
    } catch (error: any) {
        console.error('[ChatController] Error getting unread counts:', error);
        res.status(500).json({ success: false, message: 'Error fetching unread counts' });
    }
};

export const markAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const { teamId } = req.params;

        // Verify access first
        const hasAccess = await chatService.verifyChatAccess(userId, teamId);
        if (!hasAccess) {
            res.status(403).json({ success: false, message: 'You do not have access to this team chat.' });
            return;
        }

        await chatService.markAsRead(userId, teamId);
        res.status(200).json({ success: true, message: 'Marked as read' });
    } catch (error: any) {
        console.error('[ChatController] Error marking as read:', error);
        res.status(500).json({ success: false, message: 'Error marking messages as read' });
    }
};

export const getCommitteeMessages = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin' && user.role !== 'mentor') {
            res.status(403).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const messages = await chatService.getCommitteeMessages(limit, offset);
        res.status(200).json({ success: true, data: messages });
    } catch (error: any) {
        console.error('[ChatController] Error getting committee messages:', error);
        res.status(500).json({ success: false, message: 'Error fetching committee messages' });
    }
};

export const sendCommitteeMessage = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin' && user.role !== 'mentor') {
            res.status(403).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const { message } = req.body;
        
        if (!message && !req.file) {
            res.status(400).json({ success: false, message: 'Message or image is required' });
            return;
        }
        
        let imageUrl = null;
        if (req.file) {
            imageUrl = await uploadImageToCloudinary(req.file, `hackathon_chat/committee`);
        }

        const newMessage = await chatService.sendCommitteeMessage(user.id, message || '', imageUrl);

        // Emit to socket room
        req.app.locals.io?.to('committee_chat').emit('newCommitteeMessage', newMessage);

        // Notify individual committee members (for global unread badges)
        const committeeUsers = await chatService.getCommitteeUserIds();
        committeeUsers.forEach(id => {
            if (id !== user.id) { // Don't notify the sender
                req.app.locals.io?.to(`user_${id}`).emit('unreadCommitteeMessageUpdate');
            }
        });

        res.status(201).json({ success: true, data: newMessage });
    } catch (error: any) {
        console.error('[ChatController] Error sending committee message:', error);
        res.status(500).json({ success: false, message: 'Error sending committee message' });
    }
};

export const getCommitteeUnreadCounts = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin' && user.role !== 'mentor') {
            res.status(403).json({ success: false, message: 'Unauthorized' });
            return;
        }

        const count = await chatService.getCommitteeUnreadCount(user.id);
        res.status(200).json({ success: true, data: { unread: count } });
    } catch (error: any) {
        console.error('[ChatController] Error getting committee unread counts:', error);
        res.status(500).json({ success: false, message: 'Error fetching committee unread counts' });
    }
};

export const markCommitteeAsRead = async (req: Request, res: Response): Promise<void> => {
    try {
        const user = (req as any).user;
        if (user.role !== 'admin' && user.role !== 'mentor') {
            res.status(403).json({ success: false, message: 'Unauthorized' });
            return;
        }

        await chatService.markCommitteeAsRead(user.id);
        res.status(200).json({ success: true, message: 'Marked committee chat as read' });
    } catch (error: any) {
        console.error('[ChatController] Error marking committee as read:', error);
        res.status(500).json({ success: false, message: 'Error marking committee messages as read' });
    }
};

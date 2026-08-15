import { Request, Response, NextFunction } from 'express';
import * as userService from './user.service';
import { sanitizeUserProfile } from './user.sanitizer';

export const getProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const profile = await userService.getProfile(userId);
        
        res.status(200).json({
            status: 'success',
            success: true,
            data: profile // might be null if they haven't created it yet
        });
    } catch (error) {
        next(error);
    }
};

export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const sanitized = sanitizeUserProfile(req.body);

        const updatedProfile = await userService.upsertProfile({
            userId,
            name: sanitized.name,
            studentId: sanitized.student_id,
            batchSession: sanitized.batch_session,
            phoneNumber: sanitized.phone_number
        });

        res.status(200).json({
            status: 'success',
            success: true,
            message: 'Profile updated successfully',
            data: updatedProfile
        });
    } catch (error) {
        next(error);
    }
};

export const searchUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { q } = req.query;
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ status: 'error', message: 'Query parameter "q" is required' });
        }

        const users = await userService.searchUsers(q);
        
        res.status(200).json({
            status: 'success',
            success: true,
            data: users
        });
    } catch (error) {
        next(error);
    }
};

export const uploadAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const file = req.file;
        if (!file) {
            return res.status(400).json({ status: 'error', message: 'No file uploaded' });
        }

        const avatarUrl = await userService.uploadAvatarToCloudinary(userId, file);

        const io = req.app.locals.io;
        if (io) {
            io.emit('user_avatar_updated', { userId, avatarUrl });
        }

        res.status(200).json({
            status: 'success',
            success: true,
            message: 'Avatar uploaded successfully',
            data: { avatar_url: avatarUrl }
        });
    } catch (error) {
        next(error);
    }
};

import { Request, Response, NextFunction } from 'express';
import * as authService from './auth.service';
import { sanitizeAuthInput } from './auth.sanitizer';

export const register = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Sanitize the inputs before sending to service
        const sanitizedData = sanitizeAuthInput(req.body);
        
        const user = await authService.registerUser(sanitizedData);
        
        req.app.locals.io?.emit('statsUpdated');

        res.status(201).json({ 
            status: 'success', 
            message: 'User registered successfully', 
            data: user 
        });
    } catch (error) {
        next(error);
    }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
    try {
        // Sanitize inputs
        const { email, password } = sanitizeAuthInput(req.body);
        
        // Validate presence after sanitization
        if (!email || !password) {
            return res.status(400).json({ status: 'error', message: 'Email and password are required' });
        }
        
        const authData = await authService.loginUser(email, password);
        
        res.status(200).json({ 
            status: 'success', 
            message: 'Logged in successfully',
            token: authData.token,
            data: authData.user 
        });
    } catch (error) {
        next(error);
    }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const userId = (req as any).user.id;
        const profile = await authService.getMe(userId);

        res.status(200).json({
            status: 'success',
            success: true,
            data: profile
        });
    } catch (error: any) {
        next(error);
    }
};

export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { email } = sanitizeAuthInput(req.body);
        
        if (!email) {
            return res.status(400).json({ status: 'error', message: 'Email is required' });
        }

        await authService.requestPasswordReset(email);

        res.status(200).json({
            status: 'success',
            message: 'An OTP has been sent to your email.'
        });
    } catch (error) {
        next(error);
    }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { otp, newPassword } = req.body; 
        const { email } = sanitizeAuthInput(req.body);

        if (!email || !otp || !newPassword) {
            return res.status(400).json({ status: 'error', message: 'Email, OTP, and new password are required' });
        }

        await authService.resetPassword(email, otp, newPassword);

        res.status(200).json({
            status: 'success',
            message: 'Password reset successfully'
        });
    } catch (error) {
        next(error);
    }
};
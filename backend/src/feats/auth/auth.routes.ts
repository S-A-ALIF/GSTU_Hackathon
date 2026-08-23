import { Router } from 'express';
import * as authController from './auth.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { registerSchema, loginSchema } from './auth.validator';
import { authMiddleware } from './auth.middleware';

const router = Router();

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post(
    '/register', 
    validateRequest(registerSchema), 
    authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login a user
 * @access  Public
 */
router.post(
    '/login', 
    validateRequest(loginSchema), 
    authController.login
);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get current user
 * @access  Private
 */
router.get(
    '/me',
    authMiddleware,
    authController.getMe
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Request password reset OTP
 * @access  Public
 */
router.post(
    '/forgot-password',
    authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/verify-otp
 * @desc    Verify OTP for password reset
 * @access  Public
 */
router.post(
    '/verify-otp',
    authController.verifyOtp
);

/**
 * @route   POST /api/v1/auth/reset-password
 * @desc    Reset password using OTP
 * @access  Public
 */
router.post(
    '/reset-password',
    authController.resetPassword
);

export default router;
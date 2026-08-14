import { Router } from 'express';
import * as userController from './user.controller';
import { validateRequest } from '../../middlewares/validateRequest';
import { userProfileSchema } from './user.validator';
import { authMiddleware } from '../auth/auth.middleware';
import multer from 'multer';

const router = Router();

router.use(authMiddleware);

/**
 * @route   GET /api/v1/users/profile
 * @desc    Get the current user's profile info
 * @access  Private
 */
router.get(
    '/profile',
    userController.getProfile
);

/**
 * @route   PUT /api/v1/users/profile
 * @desc    Update or create the current user's profile info
 * @access  Private
 */
router.put(
    '/profile',
    validateRequest(userProfileSchema),
    userController.updateProfile
);

/**
 * @route   GET /api/v1/users/search
 * @desc    Search users by name, email, or student ID
 * @access  Private
 */
router.get(
    '/search',
    userController.searchUsers
);

const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only JPG, PNG, and WebP are allowed.'));
        }
    }
});

/**
 * @route   POST /api/v1/users/profile/avatar
 * @desc    Upload or update the user's avatar image
 * @access  Private
 */
router.post(
    '/profile/avatar',
    upload.single('avatar'),
    userController.uploadAvatar
);

export default router;

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { getTeamMessages, sendMessage, getUnreadCounts, markAsRead, getCommitteeMessages, sendCommitteeMessage, getCommitteeUnreadCounts, markCommitteeAsRead, editMessage, deleteMessage, editCommitteeMessage, deleteCommitteeMessage } from './chat.controller';
import { authMiddleware } from '../auth/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { chatValidator } from './chat.validator';

const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'));
        }
    }
});

// Wrapper to catch Multer errors gracefully
const handleUpload = (req: Request, res: Response, next: NextFunction) => {
    const uploadSingle = upload.single('image');
    uploadSingle(req, res, (err) => {
        if (err instanceof multer.MulterError) {
            return res.status(400).json({ success: false, message: `Upload error: ${err.message}` });
        } else if (err) {
            return res.status(400).json({ success: false, message: err.message });
        }
        next();
    });
};

router.use(authMiddleware);

router.get('/committee/unread', getCommitteeUnreadCounts);
router.post('/committee/read', markCommitteeAsRead);
router.get('/committee', getCommitteeMessages);
router.post('/committee', handleUpload, validateRequest(chatValidator.messageSchema), sendCommitteeMessage);
router.put('/committee/messages/:messageId', validateRequest(chatValidator.messageSchema), editCommitteeMessage);
router.delete('/committee/messages/:messageId', deleteCommitteeMessage);

router.get('/unread', getUnreadCounts);
router.post('/read/:teamId', markAsRead);

router.get('/:teamId', getTeamMessages);
router.post('/:teamId', handleUpload, validateRequest(chatValidator.messageSchema), sendMessage);
router.put('/:teamId/messages/:messageId', validateRequest(chatValidator.messageSchema), editMessage);
router.delete('/:teamId/messages/:messageId', deleteMessage);

export default router;

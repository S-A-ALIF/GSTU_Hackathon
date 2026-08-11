import { Router } from 'express';
import { authMiddleware, adminMiddleware } from '../auth/auth.middleware';
import { validateRequest } from '../../middlewares/validateRequest';
import { adminSchemas } from './admin.validator';
import {
    getStats,
    getAllTeams,
    updateTeam,
    deleteTeam,
    getAllMembers,
    updateMember,
    deleteMember,
    getSettings,
    toggleRegistration,
    toggleWorkspace,
    toggleProblems,
    toggleFeedback,
    updateTeamLimits,
    updateRegistrationTimeline,
    updateHackathonTimeline,
    deleteMultipleMembers,
    deleteMultipleTeams,
    sendAdminMessage,
    getAdminMessageHistory,
    updateAdminMessage,
    deleteAdminMessage,
    getAllSubmissions,
    rejectSubmission
} from './admin.controller';

const router = Router();

// Enforce authentication and admin privileges on all admin routes
router.use(authMiddleware, adminMiddleware);

// Dashboard Statistics
router.get('/stats', getStats);

// Broadcast / Send Message
router.get('/messages/history', getAdminMessageHistory);
router.post('/messages/send', sendAdminMessage);
router.put('/messages/:id', updateAdminMessage);
router.delete('/messages/:id', deleteAdminMessage);

// Teams Management
router.get('/teams', getAllTeams);
router.get('/submissions', getAllSubmissions);
router.post('/submissions/:teamId/reject', rejectSubmission);
router.post('/teams/bulk-delete', deleteMultipleTeams);
router.patch('/teams/:id', validateRequest(adminSchemas.updateTeam), updateTeam);
router.delete('/teams/:id', deleteTeam);

// Members Management
router.get('/members', getAllMembers);
router.post('/members/bulk-delete', deleteMultipleMembers);
router.patch('/members/:id', validateRequest(adminSchemas.updateMember), updateMember);
router.delete('/members/:id', deleteMember);

// Platform Settings
router.get('/settings', getSettings);
router.post('/settings/toggle-registration', toggleRegistration);
router.post('/settings/toggle-workspace', toggleWorkspace);
router.post('/settings/toggle-problems', toggleProblems);
router.post('/settings/toggle-feedback', toggleFeedback);
router.post('/settings/team-limits', validateRequest(adminSchemas.teamLimits), updateTeamLimits);
router.post('/settings/registration-timeline', updateRegistrationTimeline);
router.post('/settings/hackathon-timeline', updateHackathonTimeline);

export default router;


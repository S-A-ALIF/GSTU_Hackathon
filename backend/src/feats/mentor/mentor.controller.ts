import { Request, Response } from 'express';
import { mentorService } from './mentor.service';

export const getMentorsList = async (req: Request, res: Response): Promise<void> => {
    try {
        const mentors = await mentorService.getMentorsList();
        res.status(200).json({ success: true, data: mentors });
    } catch (error: any) {
        console.error('[MentorController] Error fetching mentors:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch mentors list' });
    }
};

export const inviteMentor = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        const { teamId, mentorId } = req.body;

        if (!teamId || !mentorId) {
            res.status(400).json({ success: false, message: 'Team ID and Mentor ID are required' });
            return;
        }

        await mentorService.inviteMentor(leaderId, teamId, mentorId);
        req.app.locals.io?.emit('statsUpdated');
        res.status(200).json({ success: true, message: 'Mentor invited successfully' });
    } catch (error: any) {
        console.error('[MentorController] Error inviting mentor:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to invite mentor' });
    }
};

export const getInvitations = async (req: Request, res: Response): Promise<void> => {
    try {
        const mentorId = (req as any).user.id;
        if ((req as any).user.role !== 'mentor') {
            res.status(403).json({ success: false, message: 'Only mentors can access this' });
            return;
        }

        const invitations = await mentorService.getInvitations(mentorId);
        res.status(200).json({ success: true, data: invitations });
    } catch (error: any) {
        console.error('[MentorController] Error getting invitations:', error);
        res.status(500).json({ success: false, message: 'Failed to get invitations' });
    }
};

export const respondToInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
        const mentorId = (req as any).user.id;
        if ((req as any).user.role !== 'mentor') {
            res.status(403).json({ success: false, message: 'Only mentors can access this' });
            return;
        }

        const { id } = req.params;
        const { accept, message } = req.body;

        if (typeof accept !== 'boolean') {
            res.status(400).json({ success: false, message: 'Accept boolean flag is required' });
            return;
        }

        await mentorService.respondToInvitation(mentorId, id, accept, message);
        req.app.locals.io?.emit('statsUpdated');
        res.status(200).json({ success: true, message: accept ? 'Invitation accepted' : 'Invitation rejected' });
    } catch (error: any) {
        console.error('[MentorController] Error responding to invitation:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to respond to invitation' });
    }
};

export const getMentoredTeams = async (req: Request, res: Response): Promise<void> => {
    try {
        const mentorId = (req as any).user.id;
        if ((req as any).user.role !== 'mentor') {
            res.status(403).json({ success: false, message: 'Only mentors can access this' });
            return;
        }

        const teams = await mentorService.getMentoredTeams(mentorId);
        res.status(200).json({ success: true, data: teams });
    } catch (error: any) {
        console.error('[MentorController] Error getting mentored teams:', error);
        res.status(500).json({ success: false, message: 'Failed to get mentored teams' });
    }
};

export const resignMentorship = async (req: Request, res: Response): Promise<void> => {
    try {
        const mentorId = (req as any).user.id;
        if ((req as any).user.role !== 'mentor') {
            res.status(403).json({ success: false, message: 'Only mentors can access this' });
            return;
        }

        const { id } = req.params;
        await mentorService.resignMentorship(mentorId, id);
        req.app.locals.io?.emit('statsUpdated');
        res.status(200).json({ success: true, message: 'Resigned successfully' });
    } catch (error: any) {
        console.error('[MentorController] Error resigning mentorship:', error);
        res.status(400).json({ success: false, message: error.message || 'Failed to resign mentorship' });
    }
};

import { Request, Response } from 'express';
import { teamService } from './team.service';
import { pool } from '../../config/db.config';
import { sanitizeTeamInput } from './team.sanitizer';

export const createTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const { name } = sanitizeTeamInput(req.body);

        if (!name || name === '') {
            res.status(400).json({ success: false, status: 'error', message: 'Team name is required' });
            return;
        }

        const teamId = await teamService.createTeam(userId, name);

        res.status(201).json({ success: true, status: 'success', message: 'Team created successfully!', data: { teamId } });
    } catch (error: any) {
        console.error('[TeamController] Error creating team:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error creating team' });
    }
};

export const inviteToTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const { emailToInvite } = sanitizeTeamInput(req.body);

        if (!emailToInvite) {
            res.status(400).json({ success: false, status: 'error', message: 'Email to invite is required' });
            return;
        }

        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        if (userRes.rows.length === 0) {
            res.status(404).json({ success: false, status: 'error', message: 'User not found' });
            return;
        }
        const userEmail = userRes.rows[0].email;

        // 1. Get Team for this user
        let teamId = await teamService.getUserTeam(userId);
        if (!teamId) {
            res.status(400).json({ success: false, status: 'error', message: 'You must create a team first before inviting members' });
            return;
        }

        // 2. Send in-app invite
        await teamService.inviteMember(userId, userEmail, teamId, emailToInvite);

        const msg = `Invitation sent to ${emailToInvite}! They can accept or reject from their notifications.`;

        res.status(200).json({ 
            success: true, 
            status: 'success',
            message: msg
        });
    } catch (error: any) {
        console.error('[TeamController] Error inviting to team:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error sending invitation' });
    }
};

export const joinTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const { pinCode } = sanitizeTeamInput(req.body);

        if (!pinCode || pinCode.length !== 6) {
            res.status(400).json({ success: false, status: 'error', message: 'A valid 6-digit PIN is required' });
            return;
        }

        await teamService.joinTeamWithPin(userId, pinCode);

        res.status(200).json({ success: true, status: 'success', message: 'Successfully joined the team!' });
    } catch (error: any) {
        console.error('[TeamController] Error joining team:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error joining team' });
    }
};

export const requestToJoinByCode = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const { teamCode } = sanitizeTeamInput(req.body);

        if (!teamCode || teamCode === '') {
            res.status(400).json({ success: false, status: 'error', message: 'Team code is required' });
            return;
        }

        const userRes = await pool.query('SELECT email FROM users WHERE id = $1', [userId]);
        const userEmail = userRes.rows[0]?.email || 'Unknown User';

        const result = await teamService.requestToJoinByCode(userId, userEmail, teamCode);

        res.status(200).json({ success: true, status: 'success', message: `Join request sent to team "${result.teamName}" leader!`, data: result });
    } catch (error: any) {
        console.error('[TeamController] Error sending join request:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error sending join request' });
    }
};

export const getMyTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        
        const teamDetails = await teamService.getMyTeamDetails(userId);
        
        if (!teamDetails) {
            res.status(200).json({ success: true, status: 'success', data: null });
            return;
        }

        res.status(200).json({ success: true, status: 'success', data: teamDetails });
    } catch (error: any) {
        console.error('[TeamController] Error getting team details:', error);
        res.status(500).json({ success: false, status: 'error', message: 'Internal server error' });
    }
};

export const removeMember = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        const { userId } = req.params;

        if (!userId) {
            res.status(400).json({ success: false, status: 'error', message: 'User ID to remove is required' });
            return;
        }

        await teamService.removeMember(leaderId, userId);
        res.status(200).json({ success: true, status: 'success', message: 'Member removed from team' });
    } catch (error: any) {
        console.error('[TeamController] Error removing member:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error removing member' });
    }
};

export const leaveTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user.id;
        const result = await teamService.leaveTeam(userId);

        res.status(200).json({ success: true, status: 'success', message: 'Left team successfully', data: result });
    } catch (error: any) {
        console.error('[TeamController] Error leaving team:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error leaving team' });
    }
};

export const disbandTeam = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        await teamService.disbandTeam(leaderId);

        res.status(200).json({ success: true, status: 'success', message: 'Team disbanded successfully' });
    } catch (error: any) {
        console.error('[TeamController] Error disbanding team:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error disbanding team' });
    }
};

export const updateTeamName = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        const { name } = sanitizeTeamInput(req.body);
        const updatedTeam = await teamService.updateTeamName(leaderId, name);

        res.status(200).json({ success: true, status: 'success', message: 'Team name updated successfully', data: updatedTeam });
    } catch (error: any) {
        console.error('[TeamController] Error updating team name:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error updating team name' });
    }
};

export const transferLeadership = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        const { newLeaderId } = sanitizeTeamInput(req.body);
        await teamService.transferLeadership(leaderId, newLeaderId);

        res.status(200).json({ success: true, status: 'success', message: 'Leadership transferred successfully' });
    } catch (error: any) {
        console.error('[TeamController] Error transferring leadership:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error transferring leadership' });
    }
};

export const updateTeamStatus = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = (req as any).user?.id;
        if (!userId) {
            res.status(401).json({ success: false, status: 'error', message: 'Unauthorized' });
            return;
        }

        const { is_full } = sanitizeTeamInput(req.body);
        const result = await teamService.updateTeamStatus(userId, Boolean(is_full));

        res.status(200).json({ success: true, status: 'success', message: 'Team status updated', is_full: result.is_full });
    } catch (error: any) {
        console.error('[TeamController] Error updating team status:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error updating team status' });
    }
};

export const getActiveInvitations = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        const invitations = await teamService.getActiveInvitations(leaderId);
        res.status(200).json({ success: true, status: 'success', data: invitations });
    } catch (error: any) {
        console.error('[TeamController] Error getting active invitations:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error fetching active invitations' });
    }
};

export const cancelInvitation = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        const { id } = req.params;
        await teamService.cancelInvitation(leaderId, id);
        res.status(200).json({ success: true, status: 'success', message: 'Invitation cancelled successfully' });
    } catch (error: any) {
        console.error('[TeamController] Error cancelling invitation:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error cancelling invitation' });
    }
};

export const updateSubmissionLinks = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        const { repo_url, live_url, video_url } = req.body;
        if (!repo_url || typeof repo_url !== 'string' || !live_url || typeof live_url !== 'string' || !video_url || typeof video_url !== 'string') {
            res.status(400).json({ success: false, status: 'error', message: 'All three submission links are required' });
            return;
        }
        const result = await teamService.updateSubmissionLinks(leaderId, repo_url.trim(), live_url.trim(), video_url.trim());
        res.status(200).json({ success: true, status: 'success', message: 'Submission links saved successfully!', data: result });
    } catch (error: any) {
        console.error('[TeamController] Error updating submission links:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error updating submission links' });
    }
};

export const submitProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const leaderId = (req as any).user.id;
        const result = await teamService.submitProject(leaderId);
        res.status(200).json({ success: true, status: 'success', message: 'Project repository submitted successfully!', data: result });
    } catch (error: any) {
        console.error('[TeamController] Error submitting project:', error);
        res.status(400).json({ success: false, status: 'error', message: error.message || 'Error submitting project' });
    }
};

export const checkRepoReadme = async (req: Request, res: Response): Promise<void> => {
    try {
        const { repo_url } = req.query;
        if (!repo_url || typeof repo_url !== 'string') {
            res.status(200).json({ success: true, status: 'invalid' });
            return;
        }
        const match = repo_url.match(/github\.com\/([^\/]+)\/([^\/\?#]+)/i);
        if (!match) {
            res.status(200).json({ success: true, status: 'invalid' });
            return;
        }
        const owner = match[1];
        const repo = match[2].replace(/\.git$/i, '');

        const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/readme`, {
            headers: { 'User-Agent': 'GSTU-Hackathon-App' }
        });
        if (ghRes.status === 200) {
            res.status(200).json({ success: true, status: 'ready' });
        } else if (ghRes.status === 404) {
            res.status(200).json({ success: true, status: 'missing' });
        } else {
            res.status(200).json({ success: true, status: 'unknown' });
        }
    } catch (error) {
        res.status(200).json({ success: true, status: 'unknown' });
    }
};

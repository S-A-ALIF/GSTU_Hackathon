import { z } from 'zod';

const STUDENT_ID_REGEX = /^\d{2}[A-Za-z]{2,3}\d{3}$/;
const STUDENT_ID_ERROR = "Student ID must be 2 session digits + 2 or 3 department letters + 3 roll digits (e.g. 22CSE020 or 22CE005)";

export const adminSchemas = {
    updateTeam: z.object({
        body: z.object({
            name: z.string().min(1, { message: "Team name must not be empty" }).max(100).optional(),
            leader_id: z.string().uuid({ message: "Invalid leader UUID" }).optional(),
            is_banned: z.boolean().optional(),
            ban_reason: z.string().nullable().optional()
        })
    }),
    updateMember: z.object({
        body: z.object({
            role: z.enum(['student', 'mentor', 'admin']).optional(),
            email: z.string().email({ message: "Invalid email address" }).optional(),
            name: z.string().optional(),
            student_id: z.string().regex(STUDENT_ID_REGEX, { message: STUDENT_ID_ERROR }).optional(),
            batch_session: z.string().optional(),
            phone_number: z.string().optional(),
            is_banned: z.boolean().optional(),
            ban_reason: z.string().nullable().optional()
        })
    }),
    teamLimits: z.object({
        body: z.object({
            min_team_members: z.union([z.number(), z.string()]).optional(),
            max_team_members: z.union([z.number(), z.string()]).optional(),
            max_teams_per_mentor: z.union([z.number(), z.string()]).optional()
        })
    })
};

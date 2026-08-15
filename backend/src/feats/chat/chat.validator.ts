import { z } from 'zod';

export const chatValidator = {
    messageSchema: z.object({
        body: z.object({
            message: z.string().trim().max(2000, 'Message is too long').optional().nullable()
        })
    })
};

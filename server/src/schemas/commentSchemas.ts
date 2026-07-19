import { z } from 'zod';

export const createCommentSchema = z.object({
  body: z.string().trim().min(1, 'Comment body is required').max(2000, 'Comment must be at most 2000 characters'),
  authorId: z.string().uuid('authorId must be a valid UUID'),
});

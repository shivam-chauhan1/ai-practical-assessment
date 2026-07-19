import { z } from 'zod';

export const createTagSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Tag name is required')
    .max(50, 'Tag name must be at most 50 characters'),
});

export const deleteTagParamsSchema = z.object({
  id: z.string().uuid('Tag id must be a valid UUID'),
});

export const tagIdsArraySchema = z.array(
  z.string().uuid('Each tag id must be a valid UUID')
).max(10, 'Maximum 10 tags per request');

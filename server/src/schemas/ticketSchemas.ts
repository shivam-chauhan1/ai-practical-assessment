import { z } from 'zod';
import { Priority, Status } from '@prisma/client';
import { tagIdsArraySchema } from './tagSchemas';

export const uuidParamSchema = z.object({
  id: z.string().uuid('id must be a valid UUID'),
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters'),
  description: z.string().trim().min(1, 'Description is required').max(5000, 'Description must be at most 5000 characters'),
  priority: z.nativeEnum(Priority, { errorMap: () => ({ message: 'Invalid priority value' }) }),
  createdBy: z.string().uuid('createdBy must be a valid UUID'),
  assignedTo: z.string().uuid('assignedTo must be a valid UUID').nullable().optional(),
  tags: tagIdsArraySchema.optional(),
});

export const updateTicketSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(200, 'Title must be at most 200 characters').optional(),
  description: z.string().trim().min(1, 'Description is required').max(5000, 'Description must be at most 5000 characters').optional(),
  priority: z.nativeEnum(Priority, { errorMap: () => ({ message: 'Invalid priority value' }) }).optional(),
  assignedTo: z.string().uuid('assignedTo must be a valid UUID').nullable().optional(),
  tags: tagIdsArraySchema.optional(),
});

export const changeStatusSchema = z.object({
  status: z.nativeEnum(Status, { errorMap: () => ({ message: 'Invalid status value' }) }),
});

export const listTicketsQuerySchema = z.object({
  keyword: z.string().optional(),
  status: z.nativeEnum(Status, { errorMap: () => ({ message: 'Invalid status value' }) }).optional(),
  tag: z.string().optional(),
  priority: z
    .string()
    .transform((val) => val.toUpperCase())
    .pipe(z.nativeEnum(Priority, {
      errorMap: () => ({
        message: `Invalid priority value. Accepted values: ${Object.values(Priority).join(', ')}`,
      }),
    }))
    .optional(),
  assignedTo: z.union([
    z.literal('unassigned'),
    z.string().uuid('assignedTo must be a valid v4 UUID'),
  ]).optional(),
  sortBy: z.enum(['updatedAt', 'priority'], {
    errorMap: () => ({
      message: 'Invalid sortBy value. Accepted values: updatedAt, priority',
    }),
  }).optional(),
  sortOrder: z.enum(['asc', 'desc'], {
    errorMap: () => ({
      message: 'Invalid sortOrder value. Accepted values: asc, desc',
    }),
  }).optional(),
  page: z
    .string()
    .refine((val) => {
      const num = Number(val);
      return Number.isInteger(num);
    }, { message: 'page must be a valid integer' })
    .transform((val) => Number(val))
    .pipe(z.number().int().min(1, 'page must be at least 1'))
    .optional(),
  pageSize: z
    .string()
    .refine((val) => {
      const num = Number(val);
      return Number.isInteger(num);
    }, { message: 'pageSize must be a valid integer' })
    .transform((val) => Number(val))
    .pipe(z.number().int().min(1, 'pageSize must be between 1 and 100').max(100, 'pageSize must be between 1 and 100'))
    .optional(),
}).passthrough();

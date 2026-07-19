import { z } from 'zod';
import { Priority, Status } from '@prisma/client';
import { tagIdsArraySchema } from './tagSchemas';

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
});

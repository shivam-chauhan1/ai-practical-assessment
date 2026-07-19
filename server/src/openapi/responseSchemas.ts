import './registry'; // Ensure extendZodWithOpenApi has been called
import { z } from 'zod';

// User response schema
export const UserResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.enum(['ADMIN', 'AGENT']),
  createdAt: z.string().datetime(),
}).openapi('UserResponse');

// Login response schema
export const LoginResponseSchema = z.object({
  token: z.string(),
  user: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
    role: z.enum(['ADMIN', 'AGENT']),
  }),
}).openapi('LoginResponse');

// Tag response schema
export const TagResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
}).openapi('TagResponse');

// Comment response schema
export const CommentResponseSchema = z.object({
  id: z.string().uuid(),
  body: z.string(),
  ticketId: z.string().uuid(),
  authorId: z.string().uuid(),
  createdAt: z.string().datetime(),
  author: UserResponseSchema,
}).openapi('CommentResponse');

// Ticket response schema (single ticket with full details)
export const TicketResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  createdBy: z.string().uuid(),
  assignedTo: z.string().uuid().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  creator: UserResponseSchema,
  assignee: UserResponseSchema.nullable(),
  tags: z.array(TagResponseSchema),
  comments: z.array(CommentResponseSchema).optional(),
  validTransitions: z.array(z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'])),
}).openapi('TicketResponse');

// Paginated ticket list response schema
export const TicketListResponseSchema = z.object({
  data: z.array(TicketResponseSchema.omit({ comments: true })),
  pagination: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
}).openapi('TicketListResponse');

// Error response schema
export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({
      field: z.string(),
      message: z.string(),
    })).optional(),
  }),
}).openapi('ErrorResponse');

// Health check response schema
export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
}).openapi('HealthResponse');

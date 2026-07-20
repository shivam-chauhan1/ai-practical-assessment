// Enums (mirrored from Prisma, not imported — client has no access to @prisma/client)
export type Status = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type Role = 'ADMIN' | 'AGENT';

// User (from GET /api/users and included in ticket/comment responses)
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

// Comment (included in ticket detail response)
export interface Comment {
  id: string;
  body: string;
  ticketId: string;
  authorId: string;
  createdAt: string;
  author: User;
}

// Tag (from GET /api/tags and included in ticket responses)
export interface Tag {
  id: string;
  name: string;
  createdAt: string;
}

// Ticket (from list and detail responses)
export interface Ticket {
  id: string;
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  createdBy: string;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
  validTransitions: Status[];
  creator: User;
  assignee: User | null;
  tags: Tag[];
}

// Ticket with comments (from GET /api/tickets/:id)
export interface TicketWithComments extends Ticket {
  comments: Comment[];
}

// Request types
export interface CreateTicketRequest {
  title: string;
  description: string;
  priority: Priority;
  createdBy: string;
  assignedTo?: string | null;
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  priority?: Priority;
  assignedTo?: string | null;
}

export interface ChangeStatusRequest {
  status: Status;
}

export interface CreateCommentRequest {
  body: string;
  authorId: string;
}

export interface TicketSearchParams {
  keyword?: string;
  status?: Status;
  tag?: string;
}

// Error response shape (consistent across all endpoints)
export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

import { PrismaClient, Status, Priority, Prisma } from '@prisma/client';
import { isValidTransition, getValidTransitions, isTerminalState } from './stateMachine';
import { NotFoundError, InvalidTransitionError, TicketLockedError, ValidationError } from '../errors';
import { validateTagIds } from './tagService';

const prisma = new PrismaClient();

export async function createTicket(data: {
  title: string;
  description: string;
  priority: string;
  createdBy: string;
  assignedTo?: string | null;
  tags?: string[];
}) {
  // Validate createdBy user exists
  const creator = await prisma.user.findUnique({ where: { id: data.createdBy } });
  if (!creator) {
    throw new NotFoundError(`User with id '${data.createdBy}' not found`);
  }

  // Validate assignedTo user exists if provided
  if (data.assignedTo) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assignedTo } });
    if (!assignee) {
      throw new NotFoundError(`User with id '${data.assignedTo}' not found`);
    }
  }

  // Validate tag IDs if provided
  if (data.tags && data.tags.length > 0) {
    const invalidIds = await validateTagIds(data.tags);
    if (invalidIds.length > 0) {
      throw new ValidationError('Invalid tag IDs', invalidIds.map(id => ({
        field: 'tags',
        message: `Tag with id '${id}' not found`,
      })));
    }
  }

  const ticket = await prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority as Prisma.EnumPriorityFieldUpdateOperationsInput['set'] & string,
      createdBy: data.createdBy,
      assignedTo: data.assignedTo ?? null,
      ...(data.tags && data.tags.length > 0 && {
        tags: { connect: data.tags.map(id => ({ id })) },
      }),
    },
    include: { creator: true, assignee: true, tags: true },
  });

  return {
    ...ticket,
    validTransitions: getValidTransitions(ticket.status),
  };
}

export interface ListTicketsParams {
  keyword?: string;
  status?: Status;
  tagIds?: string[];
  priority?: Priority;
  assignedTo?: string; // UUID or 'unassigned'
  sortBy: 'updatedAt' | 'priority';
  sortOrder: 'asc' | 'desc';
  page: number;
  pageSize: number;
}

export interface PaginatedTicketsResponse {
  data: Array<{
    id: string;
    title: string;
    description: string;
    status: Status;
    priority: Priority;
    createdBy: string;
    assignedTo: string | null;
    createdAt: Date;
    updatedAt: Date;
    creator: { id: string; name: string; email: string };
    assignee: { id: string; name: string; email: string } | null;
    tags: Array<{ id: string; name: string; createdAt: Date }>;
    validTransitions: Status[];
  }>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export async function listTickets(params: ListTicketsParams): Promise<PaginatedTicketsResponse> {
  const where: Prisma.TicketWhereInput = {};

  // Keyword filter (existing)
  if (params.keyword) {
    where.OR = [
      { title: { contains: params.keyword, mode: 'insensitive' } },
      { description: { contains: params.keyword, mode: 'insensitive' } },
    ];
  }

  // Status filter (existing)
  if (params.status) {
    where.status = params.status;
  }

  // Tag filter (existing)
  if (params.tagIds && params.tagIds.length > 0) {
    where.tags = { some: { id: { in: params.tagIds } } };
  }

  // Priority filter (new)
  if (params.priority) {
    where.priority = params.priority;
  }

  // AssignedTo filter (new)
  if (params.assignedTo) {
    if (params.assignedTo === 'unassigned') {
      where.assignedTo = null;
    } else {
      where.assignedTo = params.assignedTo;
    }
  }

  // Sort: primary sort field + secondary createdAt desc for determinism
  const orderBy: Prisma.TicketOrderByWithRelationInput[] = [
    { [params.sortBy]: params.sortOrder },
    { createdAt: 'desc' },
  ];

  // Pagination
  const skip = (params.page - 1) * params.pageSize;
  const take = params.pageSize;

  // Execute findMany + count in parallel using $transaction
  const [tickets, total] = await prisma.$transaction([
    prisma.ticket.findMany({
      where,
      orderBy,
      skip,
      take,
      include: { creator: true, assignee: true, tags: true },
    }),
    prisma.ticket.count({ where }),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / params.pageSize);

  return {
    data: tickets.map(ticket => ({
      ...ticket,
      validTransitions: getValidTransitions(ticket.status),
    })),
    pagination: {
      page: params.page,
      pageSize: params.pageSize,
      total,
      totalPages,
    },
  };
}

export async function getTicketById(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      creator: true,
      assignee: true,
      tags: true,
      comments: {
        orderBy: { createdAt: 'asc' },
        include: { author: true },
      },
    },
  });

  if (!ticket) {
    throw new NotFoundError(`Ticket with id '${id}' not found`);
  }

  return {
    ...ticket,
    validTransitions: getValidTransitions(ticket.status),
  };
}

export async function updateTicket(id: string, data: {
  title?: string;
  description?: string;
  priority?: string;
  assignedTo?: string | null;
  tags?: string[];
}) {
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) {
    throw new NotFoundError(`Ticket with id '${id}' not found`);
  }

  if (isTerminalState(ticket.status)) {
    throw new TicketLockedError();
  }

  // Validate assignedTo user exists if provided and not null
  if (data.assignedTo !== undefined && data.assignedTo !== null) {
    const assignee = await prisma.user.findUnique({ where: { id: data.assignedTo } });
    if (!assignee) {
      throw new NotFoundError(`User with id '${data.assignedTo}' not found`);
    }
  }

  // Validate tag IDs if tags field is provided
  if (data.tags !== undefined) {
    if (data.tags.length > 0) {
      const invalidIds = await validateTagIds(data.tags);
      if (invalidIds.length > 0) {
        throw new ValidationError('Invalid tag IDs', invalidIds.map(id => ({
          field: 'tags',
          message: `Tag with id '${id}' not found`,
        })));
      }
    }
  }

  // Defense-in-depth: only destructure allowed fields
  const { title, description, priority, assignedTo, tags } = data;
  const updateData: Prisma.TicketUpdateInput = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (priority !== undefined) updateData.priority = priority as any;
  if (assignedTo !== undefined) updateData.assignee = assignedTo === null ? { disconnect: true } : { connect: { id: assignedTo } };
  if (tags !== undefined) {
    updateData.tags = { set: tags.map(tagId => ({ id: tagId })) };
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: updateData,
    include: { creator: true, assignee: true, tags: true },
  });

  return {
    ...updatedTicket,
    validTransitions: getValidTransitions(updatedTicket.status),
  };
}

export async function changeTicketStatus(ticketId: string, newStatus: Status) {
  // 1. Load the ticket
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
  if (!ticket) {
    throw new NotFoundError(`Ticket with id '${ticketId}' not found`);
  }

  // 2. Check transition validity
  if (!isValidTransition(ticket.status, newStatus)) {
    const valid = getValidTransitions(ticket.status);
    throw new InvalidTransitionError(ticket.status, newStatus, valid);
  }

  // 3. Update status in one Prisma call (updatedAt auto-updates via @updatedAt)
  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: { status: newStatus },
    include: { creator: true, assignee: true },
  });

  return {
    ...updatedTicket,
    validTransitions: getValidTransitions(updatedTicket.status),
  };
}

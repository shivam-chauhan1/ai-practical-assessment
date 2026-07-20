import { PrismaClient, Status, Prisma } from '@prisma/client';
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
}

export async function listTickets(params: ListTicketsParams) {
  const where: Prisma.TicketWhereInput = {};

  if (params.keyword) {
    where.OR = [
      { title: { contains: params.keyword, mode: 'insensitive' } },
      { description: { contains: params.keyword, mode: 'insensitive' } },
    ];
  }

  if (params.status) {
    where.status = params.status;
  }

  if (params.tagIds && params.tagIds.length > 0) {
    where.tags = { some: { id: { in: params.tagIds } } };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { creator: true, assignee: true, tags: true },
  });

  return tickets.map(ticket => ({
    ...ticket,
    validTransitions: getValidTransitions(ticket.status),
  }));
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

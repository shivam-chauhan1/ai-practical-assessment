import { PrismaClient, Status, Prisma } from '@prisma/client';
import { isValidTransition, getValidTransitions, isTerminalState } from './stateMachine';
import { NotFoundError, InvalidTransitionError, TicketLockedError } from '../errors';

const prisma = new PrismaClient();

/**
 * Creates a new ticket.
 * - Validates createdBy user exists
 * - Validates assignedTo user exists (if provided)
 * - Persists with status OPEN
 * - Returns ticket with validTransitions and included creator/assignee
 */
export async function createTicket(data: {
  title: string;
  description: string;
  priority: string;
  createdBy: string;
  assignedTo?: string | null;
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

  const ticket = await prisma.ticket.create({
    data: {
      title: data.title,
      description: data.description,
      priority: data.priority as Prisma.EnumPriorityFieldUpdateOperationsInput['set'] & string,
      createdBy: data.createdBy,
      assignedTo: data.assignedTo ?? null,
    },
    include: { creator: true, assignee: true },
  });

  return {
    ...ticket,
    validTransitions: getValidTransitions(ticket.status),
  };
}

/**
 * Lists tickets with optional keyword and status filters.
 * - keyword: case-insensitive substring match on title OR description
 * - status: exact enum match
 * - AND logic between filters
 * - Ordered by updatedAt desc
 */
export async function listTickets(filters?: { keyword?: string; status?: Status }) {
  const where: Prisma.TicketWhereInput = {};

  if (filters?.keyword) {
    where.OR = [
      { title: { contains: filters.keyword, mode: 'insensitive' } },
      { description: { contains: filters.keyword, mode: 'insensitive' } },
    ];
  }

  if (filters?.status) {
    where.status = filters.status;
  }

  const tickets = await prisma.ticket.findMany({
    where,
    orderBy: { updatedAt: 'desc' },
    include: { creator: true, assignee: true },
  });

  return tickets.map(ticket => ({
    ...ticket,
    validTransitions: getValidTransitions(ticket.status),
  }));
}

/**
 * Gets a ticket by ID with comments, creator, and assignee.
 * Comments are ordered by createdAt ASC (oldest first).
 * Throws NotFoundError if ticket doesn't exist.
 */
export async function getTicketById(id: string) {
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: {
      creator: true,
      assignee: true,
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

/**
 * Updates a ticket's fields (title, description, priority, assignedTo).
 * - Checks ticket exists (404)
 * - Checks terminal state (throws TicketLockedError)
 * - Validates assignedTo ref if provided
 * - NEVER touches status
 */
export async function updateTicket(id: string, data: {
  title?: string;
  description?: string;
  priority?: string;
  assignedTo?: string | null;
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

  // Defense-in-depth: only destructure allowed fields
  const { title, description, priority, assignedTo } = data;
  const updateData: Prisma.TicketUpdateInput = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (priority !== undefined) updateData.priority = priority as any;
  if (assignedTo !== undefined) updateData.assignee = assignedTo === null ? { disconnect: true } : { connect: { id: assignedTo } };

  const updatedTicket = await prisma.ticket.update({
    where: { id },
    data: updateData,
    include: { creator: true, assignee: true },
  });

  return {
    ...updatedTicket,
    validTransitions: getValidTransitions(updatedTicket.status),
  };
}

/**
 * Changes a ticket's status, enforcing the state machine.
 * - Loads the ticket (throws NotFoundError if missing)
 * - Calls isValidTransition (throws InvalidTransitionError if invalid)
 * - Updates status and updatedAt in one Prisma call
 * - Returns the updated ticket with validTransitions for the new status
 */
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

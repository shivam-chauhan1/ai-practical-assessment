import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../errors';

const prisma = new PrismaClient();

export async function addComment(data: { body: string; authorId: string; ticketId: string }) {
  // Validate ticket exists
  const ticket = await prisma.ticket.findUnique({ where: { id: data.ticketId } });
  if (!ticket) {
    throw new NotFoundError(`Ticket with id '${data.ticketId}' not found`);
  }

  // Validate author exists
  const author = await prisma.user.findUnique({ where: { id: data.authorId } });
  if (!author) {
    throw new NotFoundError(`User with id '${data.authorId}' not found`);
  }

  const comment = await prisma.comment.create({
    data: {
      body: data.body,
      ticketId: data.ticketId,
      authorId: data.authorId,
    },
    include: { author: true },
  });

  return comment;
}

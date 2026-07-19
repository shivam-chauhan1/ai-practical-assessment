import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Returns all users (id, name, email, role) ordered by name.
 */
export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
    orderBy: { name: 'asc' },
  });
}

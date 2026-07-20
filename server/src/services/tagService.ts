import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../errors';

const prisma = new PrismaClient();

export async function createTag(name: string) {
  try {
    const tag = await prisma.tag.create({
      data: { name },
    });
    return tag;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictError('Tag with this name already exists');
    }
    throw error;
  }
}

export async function listTags() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
  });
  return tags;
}

export async function deleteTag(id: string) {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) {
    throw new NotFoundError(`Tag with id '${id}' not found`);
  }

  await prisma.tag.delete({ where: { id } });
}

export async function validateTagIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) {
    return [];
  }

  const existingTags = await prisma.tag.findMany({
    where: { id: { in: ids } },
    select: { id: true },
  });

  const existingIdSet = new Set(existingTags.map((t) => t.id));
  return ids.filter((id) => !existingIdSet.has(id));
}

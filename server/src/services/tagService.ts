import { PrismaClient, Prisma } from '@prisma/client';
import { NotFoundError, ConflictError } from '../errors';

const prisma = new PrismaClient();

/**
 * Creates a new tag.
 * - Name trimming is handled by Zod schema before reaching this layer.
 * - Catches Prisma P2002 (unique constraint violation) and throws ConflictError.
 */
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

/**
 * Lists all tags ordered alphabetically (case-insensitive).
 * Uses Prisma's orderBy with mode 'insensitive' for case-insensitive sorting.
 */
export async function listTags() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
  });
  return tags;
}

/**
 * Deletes a tag by ID.
 * Throws NotFoundError if the tag does not exist.
 */
export async function deleteTag(id: string) {
  const tag = await prisma.tag.findUnique({ where: { id } });
  if (!tag) {
    throw new NotFoundError(`Tag with id '${id}' not found`);
  }

  await prisma.tag.delete({ where: { id } });
}

/**
 * Validates that all provided tag IDs exist in the database.
 * Returns an array of IDs that do NOT exist.
 */
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

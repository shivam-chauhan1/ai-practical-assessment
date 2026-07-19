import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Property 13: Seed idempotency
 *
 * For any number of consecutive seed script executions on the same database,
 * the final state (tag count, tag names, and tag-ticket associations) should be
 * identical to the state after a single execution.
 *
 * **Validates: Requirements 6.4**
 */

const prisma = new PrismaClient();

// Allow sufficient time for seed script executions
jest.setTimeout(60000);

/**
 * Captures the current database state relevant to seed idempotency:
 * - All tags (sorted by name for stable comparison)
 * - All tag-ticket associations
 * - Total user count, ticket count, comment count
 */
async function captureDbState() {
  const tags = await prisma.tag.findMany({
    orderBy: { name: 'asc' },
    select: { name: true },
  });

  const ticketsWithTags = await prisma.ticket.findMany({
    where: { tags: { some: {} } },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      tags: {
        orderBy: { name: 'asc' },
        select: { name: true },
      },
    },
  });

  const userCount = await prisma.user.count();
  const ticketCount = await prisma.ticket.count();
  const commentCount = await prisma.comment.count();
  const tagCount = await prisma.tag.count();

  return {
    tags,
    ticketsWithTags,
    userCount,
    ticketCount,
    commentCount,
    tagCount,
  };
}

function runSeed() {
  execSync('npx ts-node prisma/seed.ts', {
    cwd: process.cwd(),
    stdio: 'pipe',
    env: { ...process.env },
  });
}

describe('Seed Idempotency', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Property 13: running seed twice produces identical state to running it once', async () => {
    // First execution - run the seed
    runSeed();
    const stateAfterFirstRun = await captureDbState();

    // Verify seed actually created data
    expect(stateAfterFirstRun.tagCount).toBeGreaterThanOrEqual(5);
    expect(stateAfterFirstRun.ticketsWithTags.length).toBeGreaterThanOrEqual(3);

    // Second execution
    runSeed();
    const stateAfterSecondRun = await captureDbState();

    // Tag count should be identical
    expect(stateAfterSecondRun.tagCount).toBe(stateAfterFirstRun.tagCount);

    // Tag names should be identical
    expect(stateAfterSecondRun.tags).toEqual(stateAfterFirstRun.tags);

    // Tag-ticket associations should be identical
    expect(stateAfterSecondRun.ticketsWithTags).toEqual(stateAfterFirstRun.ticketsWithTags);

    // User count, ticket count, and comment count should be identical between runs
    // Note: other parallel tests may create/delete users, so we compare between the two seed runs
    // which should be deterministic since the seed uses upsert
    expect(stateAfterSecondRun.userCount).toBe(stateAfterFirstRun.userCount);
    expect(stateAfterSecondRun.ticketCount).toBe(stateAfterFirstRun.ticketCount);
    expect(stateAfterSecondRun.commentCount).toBe(stateAfterFirstRun.commentCount);
  });
});

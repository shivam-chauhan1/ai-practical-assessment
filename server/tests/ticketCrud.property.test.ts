import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import fc from 'fast-check';
import app from '../src/app';

const prisma = new PrismaClient();

const TEST_USER_ID = 'c0000000-0000-4000-a000-000000000010';

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: { id: TEST_USER_ID, name: 'Property Test User', email: 'proptest@test.local', role: 'AGENT' },
  });
});

afterAll(async () => {
  await prisma.comment.deleteMany({ where: { ticket: { createdBy: TEST_USER_ID } } });
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.comment.deleteMany({ where: { ticket: { createdBy: TEST_USER_ID } } });
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
});

/**
 * Property 2: Title length validation rejects out-of-bounds values
 *
 * For any string that, after trimming, is shorter than 3 characters or longer than 200 characters,
 * submitting it as a ticket title SHALL be rejected with a 400 response containing error code
 * "VALIDATION_ERROR" and a details entry identifying the title length constraint violation.
 *
 * **Validates: Requirements 1.3, 4.3, 9.2**
 */
describe('Property 2: Title length validation rejects out-of-bounds values', () => {
  it('rejects titles that are too short (< 3 chars after trim) on POST /api/tickets', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings that after trimming are 0-2 characters long
        fc.oneof(
          // Whitespace-only strings (trim to empty)
          fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 10 }),
          // 1-2 char strings possibly padded with whitespace
          fc.tuple(
            fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 }),
            fc.string({ minLength: 1, maxLength: 2 }).filter(s => s.trim().length >= 1 && s.trim().length <= 2),
            fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 }),
          ).map(([pre, core, post]) => pre + core + post)
        ).filter(s => s.trim().length < 3),
        async (shortTitle) => {
          const res = await request(app)
            .post('/api/tickets')
            .send({
              title: shortTitle,
              description: 'A valid description',
              priority: 'MEDIUM',
              createdBy: TEST_USER_ID,
            });

          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
          expect(res.body.error.details).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'title' }),
            ])
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('rejects titles that are too long (> 200 chars after trim) on POST /api/tickets', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings that after trimming are > 200 characters
        fc.string({ minLength: 201, maxLength: 300 }).filter(s => s.trim().length > 200),
        async (longTitle) => {
          const res = await request(app)
            .post('/api/tickets')
            .send({
              title: longTitle,
              description: 'A valid description',
              priority: 'MEDIUM',
              createdBy: TEST_USER_ID,
            });

          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
          expect(res.body.error.details).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'title' }),
            ])
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('rejects titles that are too short on PATCH /api/tickets/:id', async () => {
    // Create a valid ticket first
    const ticket = await prisma.ticket.create({
      data: { title: 'Valid title', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    await fc.assert(
      fc.asyncProperty(
        // Generate strings that after trimming are 0-2 characters
        fc.oneof(
          fc.stringOf(fc.constantFrom(' ', '\t', '\n'), { minLength: 0, maxLength: 10 }),
          fc.tuple(
            fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 }),
            fc.string({ minLength: 1, maxLength: 2 }).filter(s => s.trim().length >= 1 && s.trim().length <= 2),
            fc.stringOf(fc.constantFrom(' ', '\t'), { minLength: 0, maxLength: 5 }),
          ).map(([pre, core, post]) => pre + core + post)
        ).filter(s => s.trim().length < 3),
        async (shortTitle) => {
          const res = await request(app)
            .patch(`/api/tickets/${ticket.id}`)
            .send({ title: shortTitle });

          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
          expect(res.body.error.details).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'title' }),
            ])
          );
        }
      ),
      { numRuns: 50 }
    );
  });

  it('rejects titles that are too long on PATCH /api/tickets/:id', async () => {
    // Create a valid ticket first
    const ticket = await prisma.ticket.create({
      data: { title: 'Valid title', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    await fc.assert(
      fc.asyncProperty(
        // Generate strings that after trimming are > 200 characters
        fc.string({ minLength: 201, maxLength: 300 }).filter(s => s.trim().length > 200),
        async (longTitle) => {
          const res = await request(app)
            .patch(`/api/tickets/${ticket.id}`)
            .send({ title: longTitle });

          expect(res.status).toBe(400);
          expect(res.body.error).toBeDefined();
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
          expect(res.body.error.details).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ field: 'title' }),
            ])
          );
        }
      ),
      { numRuns: 50 }
    );
  });
});

/**
 * Property 8: Ticket list ordering
 *
 * For any set of tickets in the database, a list-tickets request SHALL return
 * them ordered by updatedAt descending (most recently updated first).
 *
 * **Validates: Requirements 2.1**
 */
describe('Property 8: Ticket list ordering', () => {
  it('always returns tickets ordered by updatedAt descending', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random number of tickets (2-5) with random priorities
        fc.array(
          fc.record({
            title: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
            priority: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
          }),
          { minLength: 2, maxLength: 5 }
        ),
        async (ticketInputs) => {
          // Clean up before each run
          await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });

          // Create tickets sequentially with small delays to ensure different updatedAt
          for (const input of ticketInputs) {
            await prisma.ticket.create({
              data: {
                title: input.title,
                description: 'Property test description',
                priority: input.priority as any,
                createdBy: TEST_USER_ID,
              },
            });
            // Small delay to ensure different updatedAt timestamps
            await new Promise(r => setTimeout(r, 20));
          }

          const res = await request(app).get('/api/tickets');

          expect(res.status).toBe(200);

          // Filter only our test tickets
          const testTickets = res.body.filter((t: any) => t.createdBy === TEST_USER_ID);
          expect(testTickets.length).toBe(ticketInputs.length);

          // Verify ordering: each ticket's updatedAt should be >= next ticket's updatedAt
          for (let i = 0; i < testTickets.length - 1; i++) {
            const currentUpdatedAt = new Date(testTickets[i].updatedAt).getTime();
            const nextUpdatedAt = new Date(testTickets[i + 1].updatedAt).getTime();
            expect(currentUpdatedAt).toBeGreaterThanOrEqual(nextUpdatedAt);
          }
        }
      ),
      { numRuns: 10 }  // Fewer runs since these hit the real DB with delays
    );
  });

  it('maintains descending order even after updates', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate 3 tickets, then randomly pick one to update
        fc.integer({ min: 0, max: 2 }),
        fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
        async (indexToUpdate, newPriority) => {
          // Clean up
          await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });

          // Create 3 tickets with sequential timestamps
          const created: any[] = [];
          for (let i = 0; i < 3; i++) {
            const t = await prisma.ticket.create({
              data: {
                title: `Ordering test ticket ${i}`,
                description: 'Desc',
                priority: 'LOW',
                createdBy: TEST_USER_ID,
              },
            });
            created.push(t);
            await new Promise(r => setTimeout(r, 20));
          }

          // Update one ticket (this should bump its updatedAt)
          await new Promise(r => setTimeout(r, 30));
          await prisma.ticket.update({
            where: { id: created[indexToUpdate].id },
            data: { priority: newPriority as any },
          });

          const res = await request(app).get('/api/tickets');
          expect(res.status).toBe(200);

          const testTickets = res.body.filter((t: any) => t.createdBy === TEST_USER_ID);
          expect(testTickets.length).toBe(3);

          // The updated ticket should appear first (most recent updatedAt)
          expect(testTickets[0].id).toBe(created[indexToUpdate].id);

          // Overall ordering must be descending
          for (let i = 0; i < testTickets.length - 1; i++) {
            const currentUpdatedAt = new Date(testTickets[i].updatedAt).getTime();
            const nextUpdatedAt = new Date(testTickets[i + 1].updatedAt).getTime();
            expect(currentUpdatedAt).toBeGreaterThanOrEqual(nextUpdatedAt);
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

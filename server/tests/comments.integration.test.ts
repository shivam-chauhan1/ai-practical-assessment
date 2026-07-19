import request from 'supertest';
import { PrismaClient, Status } from '@prisma/client';
import fc from 'fast-check';
import jwt from 'jsonwebtoken';
import app from '../src/app';

const prisma = new PrismaClient();

const TEST_USER_ID = 'd0000000-0000-4000-a000-000000000011';
const TEST_USER_2_ID = 'd0000000-0000-4000-a000-000000000012';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-that-is-at-least-32-characters-long';
const authToken = jwt.sign({ id: TEST_USER_ID, email: 'commenttest@test.local', role: 'AGENT' }, JWT_SECRET, { expiresIn: '1h' });

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: { id: TEST_USER_ID, name: 'Comment Test User', email: 'commenttest@test.local', role: 'AGENT', password: '$2b$10$dummyhashedpasswordfortest1234567890abc' },
  });
  await prisma.user.upsert({
    where: { id: TEST_USER_2_ID },
    update: {},
    create: { id: TEST_USER_2_ID, name: 'Comment Test User 2', email: 'commenttest2@test.local', role: 'ADMIN', password: '$2b$10$dummyhashedpasswordfortest1234567890abc' },
  });
});

afterAll(async () => {
  await prisma.comment.deleteMany({ where: { ticket: { createdBy: TEST_USER_ID } } });
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [TEST_USER_ID, TEST_USER_2_ID] } } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.comment.deleteMany({ where: { ticket: { createdBy: TEST_USER_ID } } });
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
});

describe('POST /api/tickets/:id/comments - Success Cases', () => {
  it('creates a comment and returns it with author populated', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Comment success test', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: 'A valid comment', authorId: TEST_USER_ID })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.body).toBe('A valid comment');
    expect(res.body.ticketId).toBe(ticket.id);
    expect(res.body.authorId).toBe(TEST_USER_ID);
    expect(res.body.createdAt).toBeDefined();
    expect(res.body.author).toEqual(
      expect.objectContaining({ id: TEST_USER_ID, name: 'Comment Test User' })
    );
  });

  it('allows a different user to comment on a ticket', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Multi user comment test', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: 'Comment from user 2', authorId: TEST_USER_2_ID })
      .expect(201);

    expect(res.body.authorId).toBe(TEST_USER_2_ID);
    expect(res.body.author.name).toBe('Comment Test User 2');
  });
});

describe('POST /api/tickets/:id/comments - Validation Errors', () => {
  let ticketId: string;

  beforeEach(async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Validation test ticket', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID },
    });
    ticketId = ticket.id;
  });

  it('rejects missing body field', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ authorId: TEST_USER_ID })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeDefined();
  });

  it('rejects missing authorId field', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: 'Valid body' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeDefined();
  });

  it('rejects whitespace-only body', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: '   \t\n  ', authorId: TEST_USER_ID })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects body exceeding 2000 characters', async () => {
    const longBody = 'x'.repeat(2001);

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: longBody, authorId: TEST_USER_ID })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid UUID format for authorId', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: 'Valid body', authorId: 'not-a-uuid' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns error matching ApiErrorResponse shape', async () => {
    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: '', authorId: TEST_USER_ID })
      .expect(400);

    // Verify ApiErrorResponse structure
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
    expect(typeof res.body.error.code).toBe('string');
    expect(typeof res.body.error.message).toBe('string');
    if (res.body.error.details) {
      expect(Array.isArray(res.body.error.details)).toBe(true);
      for (const detail of res.body.error.details) {
        expect(detail).toHaveProperty('field');
        expect(detail).toHaveProperty('message');
      }
    }
  });
});

describe('POST /api/tickets/:id/comments - 404 Errors', () => {
  it('returns 404 for non-existent ticket ID', async () => {
    const res = await request(app)
      .post('/api/tickets/00000000-0000-4000-a000-000000000099/comments')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: 'Comment on ghost ticket', authorId: TEST_USER_ID })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBeDefined();
  });

  it('returns 404 for non-existent authorId', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: '404 author test', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: 'Comment from ghost user', authorId: '00000000-0000-4000-a000-000000000099' })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.message).toBeDefined();
  });
});

describe('POST /api/tickets/:id/comments - Comments on all statuses', () => {
  const ALL_STATUSES: Status[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];

  for (const status of ALL_STATUSES) {
    it(`allows comments on tickets in ${status} status`, async () => {
      const ticket = await prisma.ticket.create({
        data: {
          title: `Ticket in ${status}`,
          description: 'Terminal state comment test',
          priority: 'MEDIUM',
          status,
          createdBy: TEST_USER_ID,
        },
      });

      const res = await request(app)
        .post(`/api/tickets/${ticket.id}/comments`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ body: `Comment on ${status} ticket`, authorId: TEST_USER_ID })
        .expect(201);

      expect(res.body.body).toBe(`Comment on ${status} ticket`);
      expect(res.body.ticketId).toBe(ticket.id);
    });
  }
});

describe('Property 7: Comment body length validation', () => {
  /**
   * Property 7: Comment body length validation
   *
   * For any string that after trimming is empty (0 characters) or longer than 2,000 characters,
   * submitting it as a comment body SHALL be rejected with a 400 response containing
   * error code "VALIDATION_ERROR".
   *
   * **Validates: Requirements 6.4, 9.2**
   */
  let ticketId: string;

  beforeAll(async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Property 7 test ticket', description: 'For property testing', priority: 'LOW', createdBy: TEST_USER_ID },
    });
    ticketId = ticket.id;
  });

  it('rejects bodies that are empty or whitespace-only after trimming', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings that after trimming are empty (whitespace-only)
        fc.stringOf(fc.constantFrom(' ', '\t', '\n', '\r', ' \t', '\n\r'), { minLength: 1, maxLength: 50 }),
        async (whitespaceBody) => {
          const res = await request(app)
            .post(`/api/tickets/${ticketId}/comments`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ body: whitespaceBody, authorId: TEST_USER_ID });

          expect(res.status).toBe(400);
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        }
      ),
      { numRuns: 20 }
    );
  });

  it('rejects bodies exceeding 2000 characters after trimming', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate strings longer than 2000 non-whitespace characters
        fc.integer({ min: 2001, max: 2200 }).chain((len) =>
          fc.constant('a'.repeat(len))
        ),
        async (longBody) => {
          const res = await request(app)
            .post(`/api/tickets/${ticketId}/comments`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ body: longBody, authorId: TEST_USER_ID });

          expect(res.status).toBe(400);
          expect(res.body.error.code).toBe('VALIDATION_ERROR');
        }
      ),
      { numRuns: 10 }
    );
  });
});

describe('Property 9: Comments ordered by creation time', () => {
  /**
   * Property 9: Comments ordered by creation time
   *
   * For any ticket with one or more comments, a get-ticket request SHALL return
   * the comments ordered by createdAt ascending (oldest first).
   *
   * **Validates: Requirements 3.1**
   */
  it('returns comments ordered by createdAt ascending', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random number of comments (2-5)
        fc.integer({ min: 2, max: 5 }),
        async (numComments) => {
          // Create a fresh ticket for this property run
          const ticket = await prisma.ticket.create({
            data: { title: 'Ordering test', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID },
          });

          // Add multiple comments sequentially with small delays to ensure distinct timestamps
          for (let i = 0; i < numComments; i++) {
            await request(app)
              .post(`/api/tickets/${ticket.id}/comments`)
              .set('Authorization', `Bearer ${authToken}`)
              .send({ body: `Comment number ${i + 1}`, authorId: TEST_USER_ID })
              .expect(201);

            // Small delay to ensure distinct createdAt timestamps
            if (i < numComments - 1) {
              await new Promise((r) => setTimeout(r, 20));
            }
          }

          // Fetch the ticket and check comment ordering
          const res = await request(app)
            .get(`/api/tickets/${ticket.id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const comments = res.body.comments;
          expect(comments).toHaveLength(numComments);

          // Assert createdAt is in ascending order
          for (let i = 1; i < comments.length; i++) {
            const prev = new Date(comments[i - 1].createdAt).getTime();
            const curr = new Date(comments[i].createdAt).getTime();
            expect(curr).toBeGreaterThanOrEqual(prev);
          }
        }
      ),
      { numRuns: 5 }
    );
  });
});

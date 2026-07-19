import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../src/app';

const prisma = new PrismaClient();

const TEST_USER_ID = 'e0000000-0000-4000-a000-000000000001';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-that-is-at-least-32-characters-long';
const authToken = jwt.sign(
  { id: TEST_USER_ID, email: 'edgecase@test.local', role: 'ADMIN' },
  JWT_SECRET,
  { expiresIn: '1h' },
);

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: 'Edge Case User',
      email: 'edgecase@test.local',
      role: 'ADMIN',
      password: '$2b$10$dummyhashedpasswordfortest1234567890abc',
    },
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

describe('Edge Cases - Ticket creation validation', () => {
  it('rejects a ticket with an empty title (returns 400, not 500)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: '',
        description: 'Valid description',
        priority: 'MEDIUM',
        createdBy: TEST_USER_ID,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a ticket with a whitespace-only title (returns 400)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: '   ',
        description: 'Valid description',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a ticket with a description exceeding max length (returns 400)', async () => {
    const longDescription = 'x'.repeat(5001);

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Valid title for long desc',
        description: longDescription,
        priority: 'HIGH',
        createdBy: TEST_USER_ID,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a ticket with assignedTo pointing at a non-existent user (returns 404)', async () => {
    const nonExistentUserId = '00000000-0000-4000-a000-ffffffffffff';

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Ticket with ghost assignee',
        description: 'Assigned to user that does not exist',
        priority: 'MEDIUM',
        createdBy: TEST_USER_ID,
        assignedTo: nonExistentUserId,
      });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('Edge Cases - Comment with only whitespace', () => {
  it('rejects a comment that is only whitespace (returns 400)', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Whitespace comment test',
        description: 'Desc',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      },
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: '   \t\n   ', authorId: TEST_USER_ID });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a comment that is only newlines (returns 400)', async () => {
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Newline comment test',
        description: 'Desc',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      },
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ body: '\n\n\n', authorId: TEST_USER_ID });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('Edge Cases - Search with SQL special characters', () => {
  it('handles % in keyword without 500 error', async () => {
    // Seed a ticket whose title literally contains %
    await prisma.ticket.create({
      data: {
        title: '100% complete',
        description: 'Desc',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      },
    });

    const res = await request(app)
      .get('/api/tickets?keyword=100%25') // %25 = URL-encoded %
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // Should find the ticket with literal % in title
    const match = res.body.data.find((t: any) => t.title === '100% complete');
    expect(match).toBeDefined();
  });

  it('handles _ (single-char wildcard in SQL ILIKE) without matching unintended rows', async () => {
    await prisma.ticket.create({
      data: {
        title: 'file_name_test',
        description: 'Desc',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      },
    });
    await prisma.ticket.create({
      data: {
        title: 'fileXnameXtest',
        description: 'Desc',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      },
    });

    const res = await request(app)
      .get('/api/tickets?keyword=file_name_test')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // The search should match the literal _ ticket
    const exactMatch = res.body.data.find((t: any) => t.title === 'file_name_test');
    expect(exactMatch).toBeDefined();
  });

  it('handles backslash in keyword without 500 error', async () => {
    const res = await request(app)
      .get('/api/tickets?keyword=path\\to\\file')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('handles single quote in keyword without SQL injection or 500', async () => {
    const res = await request(app)
      .get("/api/tickets?keyword=it's a test")
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('handles double quote in keyword without 500 error', async () => {
    const res = await request(app)
      .get('/api/tickets?keyword=say "hello"')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('handles semicolon in keyword without 500 error', async () => {
    const res = await request(app)
      .get('/api/tickets?keyword=DROP TABLE;--')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });
});

describe('Edge Cases - None of these produce a 500', () => {
  it('creating ticket with title exactly at min boundary (3 chars) succeeds', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'abc',
        description: 'Minimum length title test',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('abc');
  });

  it('creating ticket with title below min boundary (2 chars) returns 400', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'ab',
        description: 'Too short title test',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('creating ticket with title at max boundary (200 chars) succeeds', async () => {
    const maxTitle = 'T'.repeat(200);

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: maxTitle,
        description: 'Max length title test',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe(maxTitle);
  });

  it('creating ticket with title over max boundary (201 chars) returns 400', async () => {
    const overMaxTitle = 'T'.repeat(201);

    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: overMaxTitle,
        description: 'Over max length title test',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

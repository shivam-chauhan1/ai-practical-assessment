import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/app';

const prisma = new PrismaClient();

const TEST_USER_ID = 'c0000000-0000-4000-a000-000000000001';
const TEST_USER_2_ID = 'c0000000-0000-4000-a000-000000000002';

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: { id: TEST_USER_ID, name: 'CRUD Test User', email: 'crudtest@test.local', role: 'AGENT' },
  });
  await prisma.user.upsert({
    where: { id: TEST_USER_2_ID },
    update: {},
    create: { id: TEST_USER_2_ID, name: 'CRUD Test User 2', email: 'crudtest2@test.local', role: 'ADMIN' },
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

describe('POST /api/tickets', () => {
  it('creates a ticket with valid data and returns it with status OPEN', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Test ticket creation',
        description: 'A test description for CRUD test',
        priority: 'HIGH',
        createdBy: TEST_USER_ID,
        assignedTo: TEST_USER_2_ID,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.status).toBe('OPEN');
    expect(res.body.title).toBe('Test ticket creation');
    expect(res.body.priority).toBe('HIGH');
    expect(res.body.creator.id).toBe(TEST_USER_ID);
    expect(res.body.assignee.id).toBe(TEST_USER_2_ID);
    expect(res.body.validTransitions).toEqual(expect.arrayContaining(['IN_PROGRESS', 'CANCELLED']));
  });

  it('rejects a ticket with missing title', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({
        description: 'No title here',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'title' })])
    );
  });

  it('rejects a ticket with non-existent createdBy user', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Ghost user ticket',
        description: 'This user does not exist',
        priority: 'MEDIUM',
        createdBy: '00000000-0000-0000-0000-000000000000',
      })
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/tickets', () => {
  it('returns tickets ordered by updatedAt descending', async () => {
    // Create two tickets
    await prisma.ticket.create({
      data: { title: 'First ticket', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });
    // Small delay to ensure different updatedAt
    await new Promise(r => setTimeout(r, 50));
    await prisma.ticket.create({
      data: { title: 'Second ticket', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID },
    });

    const res = await request(app).get('/api/tickets').expect(200);

    // Find our test tickets in the response
    const testTickets = res.body.filter((t: any) => t.createdBy === TEST_USER_ID);
    expect(testTickets.length).toBe(2);
    // Most recently updated should be first
    expect(new Date(testTickets[0].updatedAt).getTime())
      .toBeGreaterThanOrEqual(new Date(testTickets[1].updatedAt).getTime());
  });

  it('filters by keyword (case-insensitive substring)', async () => {
    await prisma.ticket.create({
      data: { title: 'UniqueKeywordXyz ticket', description: 'Normal desc', priority: 'MEDIUM', createdBy: TEST_USER_ID },
    });
    await prisma.ticket.create({
      data: { title: 'Other ticket', description: 'Normal desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .get('/api/tickets?keyword=uniquekeywordxyz')
      .expect(200);

    expect(res.body.length).toBeGreaterThanOrEqual(1);
    expect(res.body.every((t: any) =>
      t.title.toLowerCase().includes('uniquekeywordxyz') ||
      t.description.toLowerCase().includes('uniquekeywordxyz')
    )).toBe(true);
  });

  it('filters by status', async () => {
    await prisma.ticket.create({
      data: { title: 'Open ticket', description: 'Desc', priority: 'LOW', status: 'OPEN', createdBy: TEST_USER_ID },
    });
    await prisma.ticket.create({
      data: { title: 'Resolved ticket', description: 'Desc', priority: 'LOW', status: 'RESOLVED', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .get('/api/tickets?status=RESOLVED')
      .expect(200);

    expect(res.body.every((t: any) => t.status === 'RESOLVED')).toBe(true);
  });

  it('combines keyword + status filter (AND logic)', async () => {
    await prisma.ticket.create({
      data: { title: 'CombinedTestAlpha', description: 'Desc', priority: 'LOW', status: 'OPEN', createdBy: TEST_USER_ID },
    });
    await prisma.ticket.create({
      data: { title: 'CombinedTestAlpha', description: 'Desc', priority: 'LOW', status: 'IN_PROGRESS', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .get('/api/tickets?keyword=CombinedTestAlpha&status=IN_PROGRESS')
      .expect(200);

    expect(res.body.length).toBe(1);
    expect(res.body[0].status).toBe('IN_PROGRESS');
    expect(res.body[0].title).toContain('CombinedTestAlpha');
  });
});

describe('GET /api/tickets/:id', () => {
  it('returns ticket with comments included', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Detail test', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID },
    });
    await prisma.comment.create({
      data: { body: 'A test comment', ticketId: ticket.id, authorId: TEST_USER_ID },
    });

    const res = await request(app)
      .get(`/api/tickets/${ticket.id}`)
      .expect(200);

    expect(res.body.id).toBe(ticket.id);
    expect(res.body.comments).toHaveLength(1);
    expect(res.body.comments[0].body).toBe('A test comment');
    expect(res.body.comments[0].author.name).toBe('CRUD Test User');
  });

  it('returns 404 for non-existent ticket', async () => {
    const res = await request(app)
      .get('/api/tickets/00000000-0000-0000-0000-000000000000')
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('PATCH /api/tickets/:id', () => {
  it('updates title and priority', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Original title', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .send({ title: 'Updated title', priority: 'URGENT' })
      .expect(200);

    expect(res.body.title).toBe('Updated title');
    expect(res.body.priority).toBe('URGENT');
  });

  it('allows setting assignedTo to null (unassign)', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Assigned ticket', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID, assignedTo: TEST_USER_2_ID },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .send({ assignedTo: null })
      .expect(200);

    expect(res.body.assignedTo).toBeNull();
    expect(res.body.assignee).toBeNull();
  });

  it('rejects updates on a CLOSED ticket with TICKET_LOCKED', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Closed ticket', description: 'Desc', priority: 'LOW', status: 'CLOSED', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .send({ title: 'Attempting edit' })
      .expect(403);

    expect(res.body.error.code).toBe('TICKET_LOCKED');
  });

  it('IGNORES a status field in the PATCH body — status is unchanged', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Status ignore test', description: 'Desc', priority: 'LOW', status: 'OPEN', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .patch(`/api/tickets/${ticket.id}`)
      .send({ title: 'New title', status: 'CLOSED' })
      .expect(200);

    // The response should show the updated title but status should still be OPEN
    expect(res.body.title).toBe('New title');
    expect(res.body.status).toBe('OPEN');

    // Re-fetch to confirm status was NOT changed in the database
    const refetched = await prisma.ticket.findUnique({ where: { id: ticket.id } });
    expect(refetched!.status).toBe('OPEN');
  });
});

describe('POST /api/tickets/:id/comments', () => {
  it('adds a comment and returns it with author populated', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Comment test', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ body: 'This is a comment', authorId: TEST_USER_ID })
      .expect(201);

    expect(res.body.body).toBe('This is a comment');
    expect(res.body.author.name).toBe('CRUD Test User');
    expect(res.body.ticketId).toBe(ticket.id);
  });

  it('allows comments on CLOSED tickets (terminal state)', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Closed for comments', description: 'Desc', priority: 'LOW', status: 'CLOSED', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ body: 'Comment on closed ticket', authorId: TEST_USER_ID })
      .expect(201);

    expect(res.body.body).toBe('Comment on closed ticket');
  });

  it('rejects empty comment body', async () => {
    const ticket = await prisma.ticket.create({
      data: { title: 'Empty comment test', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .post(`/api/tickets/${ticket.id}/comments`)
      .send({ body: '   ', authorId: TEST_USER_ID })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

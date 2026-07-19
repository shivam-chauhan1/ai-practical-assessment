import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import app from '../src/app';

const prisma = new PrismaClient();

const TEST_ADMIN_ID = 'd0000000-0000-4000-a000-000000000001';
const TEST_AGENT_ID = 'd0000000-0000-4000-a000-000000000002';
const TEST_PASSWORD = 'password123';

let adminToken: string;
let agentToken: string;

beforeAll(async () => {
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);

  await prisma.user.upsert({
    where: { id: TEST_ADMIN_ID },
    update: { password: hashedPassword },
    create: {
      id: TEST_ADMIN_ID,
      name: 'Auth Test Admin',
      email: 'authadmin@test.local',
      role: 'ADMIN',
      password: hashedPassword,
    },
  });

  await prisma.user.upsert({
    where: { id: TEST_AGENT_ID },
    update: { password: hashedPassword },
    create: {
      id: TEST_AGENT_ID,
      name: 'Auth Test Agent',
      email: 'authagent@test.local',
      role: 'AGENT',
      password: hashedPassword,
    },
  });
});

afterAll(async () => {
  await prisma.comment.deleteMany({ where: { ticket: { createdBy: { in: [TEST_ADMIN_ID, TEST_AGENT_ID] } } } });
  await prisma.ticket.deleteMany({ where: { createdBy: { in: [TEST_ADMIN_ID, TEST_AGENT_ID] } } });
  await prisma.user.deleteMany({ where: { id: { in: [TEST_ADMIN_ID, TEST_AGENT_ID] } } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.comment.deleteMany({ where: { ticket: { createdBy: { in: [TEST_ADMIN_ID, TEST_AGENT_ID] } } } });
  await prisma.ticket.deleteMany({ where: { createdBy: { in: [TEST_ADMIN_ID, TEST_AGENT_ID] } } });
});

describe('Auth Integration: Full Login Flow', () => {
  it('POST /api/auth/login returns token and user on valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authadmin@test.local', password: TEST_PASSWORD })
      .expect(200);

    expect(res.body.token).toBeDefined();
    expect(typeof res.body.token).toBe('string');
    expect(res.body.user).toEqual({
      id: TEST_ADMIN_ID,
      name: 'Auth Test Admin',
      email: 'authadmin@test.local',
      role: 'ADMIN',
    });

    // Store for use in subsequent tests
    adminToken = res.body.token;
  });

  it('POST /api/auth/login returns token for AGENT user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authagent@test.local', password: TEST_PASSWORD })
      .expect(200);

    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('AGENT');

    agentToken = res.body.token;
  });

  it('login token can be used to access protected routes', async () => {
    // Login first
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authadmin@test.local', password: TEST_PASSWORD })
      .expect(200);

    const token = loginRes.body.token;

    // Use token on a protected route
    const ticketsRes = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(Array.isArray(ticketsRes.body.data)).toBe(true);
  });
});

describe('Auth Integration: Login endpoint accessible without token', () => {
  it('POST /api/auth/login does not require Authorization header', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authadmin@test.local', password: TEST_PASSWORD })
      .expect(200);

    expect(res.body.token).toBeDefined();
  });

  it('POST /api/auth/login with invalid credentials returns 401 without requiring token', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authadmin@test.local', password: 'wrongpassword' })
      .expect(401);

    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    expect(res.body.error.message).toBe('Invalid email or password');
  });
});

describe('Auth Integration: Protected routes return 401 without token', () => {
  it('GET /api/tickets returns 401 without Authorization header', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .expect(401);

    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('POST /api/tickets returns 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Test ticket',
        description: 'Test description',
        priority: 'HIGH',
        createdBy: TEST_AGENT_ID,
      })
      .expect(401);

    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
    expect(res.body.error.message).toBe('Authentication required');
  });

  it('GET /api/tickets/:id returns 401 without Authorization header', async () => {
    const res = await request(app)
      .get('/api/tickets/00000000-0000-0000-0000-000000000000')
      .expect(401);

    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('PATCH /api/tickets/:id/status returns 401 without Authorization header', async () => {
    const res = await request(app)
      .patch('/api/tickets/00000000-0000-0000-0000-000000000000/status')
      .send({ status: 'IN_PROGRESS' })
      .expect(401);

    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('POST /api/tickets/:id/comments returns 401 without Authorization header', async () => {
    const res = await request(app)
      .post('/api/tickets/00000000-0000-0000-0000-000000000000/comments')
      .send({ body: 'A comment', authorId: TEST_AGENT_ID })
      .expect(401);

    expect(res.body.error.code).toBe('AUTHENTICATION_ERROR');
  });
});

describe('Auth Integration: AGENT role permissions', () => {
  beforeAll(async () => {
    // Ensure we have a valid agent token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authagent@test.local', password: TEST_PASSWORD });
    agentToken = res.body.token;
  });

  it('AGENT can GET /api/tickets', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('AGENT can POST /api/tickets (create ticket)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        title: 'Agent created ticket',
        description: 'Created by an agent for integration test',
        priority: 'MEDIUM',
        createdBy: TEST_AGENT_ID,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Agent created ticket');
    expect(res.body.status).toBe('OPEN');
  });

  it('AGENT can GET /api/tickets/:id (read ticket details)', async () => {
    // Create a ticket first
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        title: 'Ticket to read',
        description: 'Agent will read this',
        priority: 'LOW',
        createdBy: TEST_AGENT_ID,
      })
      .expect(201);

    const ticketId = createRes.body.id;

    const res = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${agentToken}`)
      .expect(200);

    expect(res.body.id).toBe(ticketId);
    expect(res.body.title).toBe('Ticket to read');
  });

  it('AGENT can POST /api/tickets/:id/comments (add comment)', async () => {
    // Create a ticket first
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        title: 'Ticket for comment',
        description: 'Agent will comment on this',
        priority: 'LOW',
        createdBy: TEST_AGENT_ID,
      })
      .expect(201);

    const ticketId = createRes.body.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ body: 'Agent comment here', authorId: TEST_AGENT_ID })
      .expect(201);

    expect(res.body.body).toBe('Agent comment here');
    expect(res.body.ticketId).toBe(ticketId);
  });

  it('AGENT cannot PATCH /api/tickets/:id/status (returns 403)', async () => {
    // Create a ticket in OPEN status
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${agentToken}`)
      .send({
        title: 'Ticket agent cannot transition',
        description: 'Agent should not be able to change status',
        priority: 'MEDIUM',
        createdBy: TEST_AGENT_ID,
      })
      .expect(201);

    const ticketId = createRes.body.id;

    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${agentToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(403);

    expect(res.body.error.code).toBe('FORBIDDEN');
    expect(res.body.error.message).toContain('ADMIN');
  });
});

describe('Auth Integration: ADMIN role permissions', () => {
  beforeAll(async () => {
    // Ensure we have a valid admin token
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authadmin@test.local', password: TEST_PASSWORD });
    adminToken = res.body.token;
  });

  it('ADMIN can GET /api/tickets', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('ADMIN can POST /api/tickets (create ticket)', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Admin created ticket',
        description: 'Created by an admin for integration test',
        priority: 'HIGH',
        createdBy: TEST_ADMIN_ID,
      })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.title).toBe('Admin created ticket');
  });

  it('ADMIN can POST /api/tickets/:id/comments (add comment)', async () => {
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Ticket for admin comment',
        description: 'Admin will comment on this',
        priority: 'LOW',
        createdBy: TEST_ADMIN_ID,
      })
      .expect(201);

    const ticketId = createRes.body.id;

    const res = await request(app)
      .post(`/api/tickets/${ticketId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ body: 'Admin comment here', authorId: TEST_ADMIN_ID })
      .expect(201);

    expect(res.body.body).toBe('Admin comment here');
  });

  it('ADMIN can PATCH /api/tickets/:id/status (change status)', async () => {
    // Create a ticket in OPEN status
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Ticket for admin status change',
        description: 'Admin will change status',
        priority: 'MEDIUM',
        createdBy: TEST_ADMIN_ID,
      })
      .expect(201);

    const ticketId = createRes.body.id;

    // Transition OPEN → IN_PROGRESS
    const res = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('ADMIN can perform full status lifecycle', async () => {
    // Create ticket
    const createRes = await request(app)
      .post('/api/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Full lifecycle ticket',
        description: 'Test full status lifecycle',
        priority: 'HIGH',
        createdBy: TEST_ADMIN_ID,
      })
      .expect(201);

    const ticketId = createRes.body.id;

    // OPEN → IN_PROGRESS
    await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'IN_PROGRESS' })
      .expect(200);

    // IN_PROGRESS → RESOLVED
    await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'RESOLVED' })
      .expect(200);

    // RESOLVED → CLOSED
    const closedRes = await request(app)
      .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CLOSED' })
      .expect(200);

    expect(closedRes.body.status).toBe('CLOSED');
  });
});

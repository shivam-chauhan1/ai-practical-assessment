import request from 'supertest';
import { PrismaClient, Status } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../src/app';

const prisma = new PrismaClient();

// Stable test user ID
const TEST_USER_ID = 'test-user-0000-0000-000000000001';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-that-is-at-least-32-characters-long';
const authToken = jwt.sign({ id: TEST_USER_ID, email: 'testuser@test.local', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

// Helper: create a ticket in a specific status
async function createTicketInStatus(status: Status): Promise<string> {
  // Create directly in DB to avoid going through API (which always sets OPEN)
  const ticket = await prisma.ticket.create({
    data: {
      title: `Test ticket (${status})`,
      description: 'Test description for integration test',
      priority: 'MEDIUM',
      status,
      createdBy: TEST_USER_ID,
    },
  });
  return ticket.id;
}

beforeAll(async () => {
  // Ensure test user exists
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: 'Test User',
      email: 'testuser@test.local',
      role: 'AGENT',
      password: '$2b$10$dummyhashedpasswordfortest1234567890abc',
    },
  });
});

afterAll(async () => {
  // Clean up test data
  await prisma.comment.deleteMany({ where: { ticket: { createdBy: TEST_USER_ID } } });
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up tickets created during each test
  await prisma.comment.deleteMany({ where: { ticket: { createdBy: TEST_USER_ID } } });
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
});

describe('PATCH /api/tickets/:id/status', () => {
  // ─── Valid transitions ──────────────────────────────────────────────

  describe('Valid transitions', () => {
    it('OPEN → IN_PROGRESS succeeds and persists', async () => {
      const ticketId = await createTicketInStatus('OPEN');

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'IN_PROGRESS' })
        .expect(200);

      expect(res.body.status).toBe('IN_PROGRESS');
      expect(res.body.validTransitions).toEqual(
        expect.arrayContaining(['RESOLVED', 'CANCELLED'])
      );

      // Re-fetch to confirm persistence
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket!.status).toBe('IN_PROGRESS');
    });

    it('IN_PROGRESS → RESOLVED succeeds and persists', async () => {
      const ticketId = await createTicketInStatus('IN_PROGRESS');

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'RESOLVED' })
        .expect(200);

      expect(res.body.status).toBe('RESOLVED');

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket!.status).toBe('RESOLVED');
    });

    it('RESOLVED → CLOSED succeeds and persists', async () => {
      const ticketId = await createTicketInStatus('RESOLVED');

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'CLOSED' })
        .expect(200);

      expect(res.body.status).toBe('CLOSED');
      expect(res.body.validTransitions).toEqual([]);

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket!.status).toBe('CLOSED');
    });

    it('OPEN → CANCELLED succeeds and persists', async () => {
      const ticketId = await createTicketInStatus('OPEN');

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'CANCELLED' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');
      expect(res.body.validTransitions).toEqual([]);

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket!.status).toBe('CANCELLED');
    });

    it('IN_PROGRESS → CANCELLED succeeds and persists', async () => {
      const ticketId = await createTicketInStatus('IN_PROGRESS');

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'CANCELLED' })
        .expect(200);

      expect(res.body.status).toBe('CANCELLED');

      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket!.status).toBe('CANCELLED');
    });
  });

  // ─── Invalid transitions ────────────────────────────────────────────

  describe('Invalid transitions', () => {
    const invalidTransitions: Array<{ from: Status; to: Status }> = [
      { from: 'OPEN', to: 'RESOLVED' },
      { from: 'OPEN', to: 'CLOSED' },
      { from: 'IN_PROGRESS', to: 'OPEN' },
      { from: 'IN_PROGRESS', to: 'CLOSED' },
      { from: 'RESOLVED', to: 'OPEN' },
      { from: 'RESOLVED', to: 'IN_PROGRESS' },
      { from: 'RESOLVED', to: 'CANCELLED' },
      { from: 'CLOSED', to: 'OPEN' },
      { from: 'CLOSED', to: 'IN_PROGRESS' },
      { from: 'CLOSED', to: 'RESOLVED' },
      { from: 'CLOSED', to: 'CANCELLED' },
      { from: 'CANCELLED', to: 'OPEN' },
      { from: 'CANCELLED', to: 'IN_PROGRESS' },
      { from: 'CANCELLED', to: 'RESOLVED' },
      { from: 'CANCELLED', to: 'CLOSED' },
    ];

    it.each(invalidTransitions)(
      '$from → $to is rejected and status is unchanged',
      async ({ from, to }) => {
        const ticketId = await createTicketInStatus(from);

        const res = await request(app)
          .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: to })
          .expect(400);

        expect(res.body.error.code).toBe('INVALID_TRANSITION');
        expect(res.body.error.message).toContain(
          `Cannot transition from ${from} to ${to}`
        );

        // Re-fetch to confirm status is UNCHANGED
        const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
        expect(ticket!.status).toBe(from);
      }
    );
  });

  // ─── Invalid enum value ─────────────────────────────────────────────

  describe('Invalid status enum value', () => {
    it('rejects a completely bogus status string with VALIDATION_ERROR', async () => {
      const ticketId = await createTicketInStatus('OPEN');

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'BOGUS_STATUS' })
        .expect(400);

      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      // Re-fetch to confirm status is unchanged
      const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
      expect(ticket!.status).toBe('OPEN');
    });
  });

  // ─── Non-existent ticket ────────────────────────────────────────────

  describe('Non-existent ticket', () => {
    it('returns 404 NOT_FOUND for a missing ticket ID', async () => {
      const res = await request(app)
        .patch('/api/tickets/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'IN_PROGRESS' })
        .expect(404);

      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  // ─── Error response shape consistency ──────────────────────────────

  describe('Error response shape consistency', () => {
    it('INVALID_TRANSITION error has shape { error: { code, message } } and message lists valid transitions', async () => {
      const ticketId = await createTicketInStatus('OPEN');

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'RESOLVED' })
        .expect(400);

      // Verify top-level shape
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error.code).toBe('string');
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.code).toBe('INVALID_TRANSITION');

      // Message must list valid transitions from OPEN
      expect(res.body.error.message).toContain('Valid transitions');
      expect(res.body.error.message).toMatch(/IN_PROGRESS/);
      expect(res.body.error.message).toMatch(/CANCELLED/);
    });

    it('VALIDATION_ERROR has shape { error: { code, message, details } } with field-level info', async () => {
      const ticketId = await createTicketInStatus('OPEN');

      const res = await request(app)
        .patch(`/api/tickets/${ticketId}/status`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'BOGUS_STATUS' })
        .expect(400);

      // Verify top-level shape
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error.code).toBe('string');
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.code).toBe('VALIDATION_ERROR');

      // Verify details array with field-level validation info
      expect(Array.isArray(res.body.error.details)).toBe(true);
      expect(res.body.error.details.length).toBeGreaterThan(0);
      expect(res.body.error.details[0]).toHaveProperty('field');
      expect(res.body.error.details[0]).toHaveProperty('message');
      expect(typeof res.body.error.details[0].field).toBe('string');
      expect(typeof res.body.error.details[0].message).toBe('string');
    });

    it('NOT_FOUND error has shape { error: { code, message } }', async () => {
      const res = await request(app)
        .patch('/api/tickets/00000000-0000-0000-0000-000000000000/status')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ status: 'IN_PROGRESS' })
        .expect(404);

      // Verify top-level shape
      expect(res.body).toHaveProperty('error');
      expect(typeof res.body.error.code).toBe('string');
      expect(typeof res.body.error.message).toBe('string');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});

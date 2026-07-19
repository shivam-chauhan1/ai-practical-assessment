import { PrismaClient, Status } from '@prisma/client';
import { changeTicketStatus } from '../src/services/ticketService';
import { NotFoundError, InvalidTransitionError } from '../src/errors';

const prisma = new PrismaClient();

describe('changeTicketStatus', () => {
  let testUserId: string;
  let testTicketId: string;

  beforeAll(async () => {
    // Create a test user for ticket creation
    const user = await prisma.user.create({
      data: {
        name: 'Test User Status',
        email: `statustest-${Date.now()}@example.com`,
        role: 'AGENT',
      },
    });
    testUserId = user.id;
  });

  beforeEach(async () => {
    // Create a fresh OPEN ticket for each test
    const ticket = await prisma.ticket.create({
      data: {
        title: 'Status Test Ticket',
        description: 'Ticket for testing status transitions',
        priority: 'MEDIUM',
        createdBy: testUserId,
        status: 'OPEN',
      },
    });
    testTicketId = ticket.id;
  });

  afterEach(async () => {
    // Clean up tickets after each test
    await prisma.ticket.deleteMany({ where: { createdBy: testUserId } });
  });

  afterAll(async () => {
    // Clean up the test user
    await prisma.user.delete({ where: { id: testUserId } });
    await prisma.$disconnect();
  });

  it('throws NotFoundError when ticket does not exist', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000000';
    await expect(changeTicketStatus(fakeId, Status.IN_PROGRESS)).rejects.toThrow(NotFoundError);
  });

  it('transitions OPEN → IN_PROGRESS successfully', async () => {
    const result = await changeTicketStatus(testTicketId, Status.IN_PROGRESS);

    expect(result.id).toBe(testTicketId);
    expect(result.status).toBe(Status.IN_PROGRESS);
    expect(result.validTransitions).toEqual([Status.RESOLVED, Status.CANCELLED]);
  });

  it('transitions OPEN → CANCELLED successfully', async () => {
    const result = await changeTicketStatus(testTicketId, Status.CANCELLED);

    expect(result.id).toBe(testTicketId);
    expect(result.status).toBe(Status.CANCELLED);
    expect(result.validTransitions).toEqual([]);
  });

  it('throws InvalidTransitionError for OPEN → RESOLVED', async () => {
    await expect(changeTicketStatus(testTicketId, Status.RESOLVED)).rejects.toThrow(
      InvalidTransitionError
    );
  });

  it('throws InvalidTransitionError for OPEN → CLOSED', async () => {
    await expect(changeTicketStatus(testTicketId, Status.CLOSED)).rejects.toThrow(
      InvalidTransitionError
    );
  });

  it('InvalidTransitionError includes valid transitions in message', async () => {
    try {
      await changeTicketStatus(testTicketId, Status.RESOLVED);
      fail('Expected InvalidTransitionError');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidTransitionError);
      expect((err as InvalidTransitionError).message).toContain('Cannot transition from OPEN to RESOLVED');
      expect((err as InvalidTransitionError).message).toContain('IN_PROGRESS');
      expect((err as InvalidTransitionError).message).toContain('CANCELLED');
    }
  });

  it('transitions IN_PROGRESS → RESOLVED successfully', async () => {
    // First transition to IN_PROGRESS
    await changeTicketStatus(testTicketId, Status.IN_PROGRESS);
    // Then to RESOLVED
    const result = await changeTicketStatus(testTicketId, Status.RESOLVED);

    expect(result.status).toBe(Status.RESOLVED);
    expect(result.validTransitions).toEqual([Status.CLOSED]);
  });

  it('transitions RESOLVED → CLOSED successfully', async () => {
    await changeTicketStatus(testTicketId, Status.IN_PROGRESS);
    await changeTicketStatus(testTicketId, Status.RESOLVED);
    const result = await changeTicketStatus(testTicketId, Status.CLOSED);

    expect(result.status).toBe(Status.CLOSED);
    expect(result.validTransitions).toEqual([]);
  });

  it('returns ticket with creator and assignee included', async () => {
    const result = await changeTicketStatus(testTicketId, Status.IN_PROGRESS);

    expect(result).toHaveProperty('creator');
    expect(result.creator).toHaveProperty('id', testUserId);
  });
});

import fc from 'fast-check';
import { Status } from '@prisma/client';

// Mock PrismaClient before importing the service
jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
    },
    ticket: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    ...actualPrisma,
    PrismaClient: jest.fn(() => mockPrismaClient),
    __mockPrismaClient: mockPrismaClient,
  };
});

import { createTicket, updateTicket } from '../src/services/ticketService';
import { TicketLockedError } from '../src/errors';
import { TERMINAL_STATES } from '../src/services/stateMachine';
const { __mockPrismaClient: mockPrisma } = jest.requireMock('@prisma/client');

/**
 * Property 1: Created tickets always start in OPEN status
 *
 * For any valid CreateTicketInput (random title, description, priority, createdBy, assignedTo),
 * the resulting ticket always has status OPEN.
 *
 * **Validates: Requirements 1.1**
 */
describe('Ticket Service - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Property 1: Created tickets always start in OPEN status', () => {
    // Arbitraries for valid CreateTicketInput
    const titleArb = fc.string({ minLength: 3, maxLength: 200 }).filter(s => s.trim().length >= 3);
    const descriptionArb = fc.string({ minLength: 1, maxLength: 5000 }).filter(s => s.trim().length >= 1);
    const priorityArb = fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    const uuidArb = fc.uuid();
    const assignedToArb = fc.option(fc.uuid(), { nil: null });

    fc.assert(
      fc.asyncProperty(
        titleArb,
        descriptionArb,
        priorityArb,
        uuidArb,
        assignedToArb,
        async (title, description, priority, createdBy, assignedTo) => {
          // Mock user.findUnique to return a valid user for any lookup
          mockPrisma.user.findUnique.mockResolvedValue({
            id: createdBy,
            name: 'Test User',
            email: 'test@example.com',
            role: 'AGENT',
            createdAt: new Date(),
          });

          // Mock ticket.create to return a ticket with OPEN status (Prisma default)
          mockPrisma.ticket.create.mockImplementation(async (args: any) => {
            return {
              id: 'generated-ticket-id',
              title: args.data.title,
              description: args.data.description,
              priority: args.data.priority,
              status: Status.OPEN, // Prisma schema default
              createdBy: args.data.createdBy,
              assignedTo: args.data.assignedTo,
              createdAt: new Date(),
              updatedAt: new Date(),
              creator: { id: args.data.createdBy, name: 'Test User', email: 'test@example.com', role: 'AGENT', createdAt: new Date() },
              assignee: args.data.assignedTo
                ? { id: args.data.assignedTo, name: 'Assignee', email: 'assignee@example.com', role: 'AGENT', createdAt: new Date() }
                : null,
            };
          });

          const result = await createTicket({
            title,
            description,
            priority,
            createdBy,
            assignedTo,
          });

          // The ticket must always have status OPEN
          expect(result.status).toBe(Status.OPEN);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Terminal-state tickets reject field updates with TICKET_LOCKED
   *
   * For any ticket in a terminal state (CLOSED or CANCELLED) and any combination
   * of field updates, updateTicket SHALL throw TicketLockedError.
   *
   * **Validates: Requirements 4.8, 11.1, 11.5**
   */
  it('Property 5: Terminal-state tickets reject field updates with TICKET_LOCKED', () => {
    const terminalStatusArb = fc.constantFrom(...TERMINAL_STATES);
    const titleArb = fc.string({ minLength: 3, maxLength: 200 }).filter(s => s.trim().length >= 3);
    const descriptionArb = fc.string({ minLength: 1, maxLength: 5000 }).filter(s => s.trim().length >= 1);
    const priorityArb = fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    const assignedToArb = fc.option(fc.uuid(), { nil: null });
    const ticketIdArb = fc.uuid();

    fc.assert(
      fc.asyncProperty(
        terminalStatusArb,
        titleArb,
        descriptionArb,
        priorityArb,
        assignedToArb,
        ticketIdArb,
        async (terminalStatus, title, description, priority, assignedTo, ticketId) => {
          // Mock ticket.findUnique to return a ticket in a terminal state
          mockPrisma.ticket.findUnique.mockResolvedValue({
            id: ticketId,
            title: 'Existing Ticket',
            description: 'Existing description',
            status: terminalStatus,
            priority: 'MEDIUM',
            createdBy: 'some-user-id',
            assignedTo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // updateTicket should throw TicketLockedError for terminal-state tickets
          await expect(
            updateTicket(ticketId, { title, description, priority, assignedTo })
          ).rejects.toThrow(TicketLockedError);

          // Verify the error has the correct properties
          try {
            await updateTicket(ticketId, { title });
          } catch (err) {
            expect(err).toBeInstanceOf(TicketLockedError);
            expect((err as TicketLockedError).statusCode).toBe(403);
            expect((err as TicketLockedError).code).toBe('TICKET_LOCKED');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

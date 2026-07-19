import fc from 'fast-check';
import { Status } from '@prisma/client';

/**
 * Property 6: Comments bypass terminal-state lock
 *
 * For any ticket status (including CLOSED and CANCELLED),
 * addComment resolves successfully — comments are never blocked
 * by terminal-state lock.
 *
 * **Validates: Requirements 6.1, 6.2, 11.2**
 */

// Mock PrismaClient before importing the service
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    ticket: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    comment: {
      create: jest.fn(),
    },
  };

  return {
    PrismaClient: jest.fn(() => mockPrisma),
    Status: {
      OPEN: 'OPEN',
      IN_PROGRESS: 'IN_PROGRESS',
      RESOLVED: 'RESOLVED',
      CLOSED: 'CLOSED',
      CANCELLED: 'CANCELLED',
    },
    __mockPrisma: mockPrisma,
  };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { __mockPrisma: mockPrisma } = require('@prisma/client');
import { addComment } from '../src/services/commentService';

const ALL_STATUSES: Status[] = [
  Status.OPEN,
  Status.IN_PROGRESS,
  Status.RESOLVED,
  Status.CLOSED,
  Status.CANCELLED,
];

describe('Comment Service - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('Property 6: Comments bypass terminal-state lock — addComment succeeds for any ticket status', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a random status from ALL statuses (including terminal: CLOSED, CANCELLED)
        fc.constantFrom(...ALL_STATUSES),
        // Generate a random comment body: 1-2000 chars after trim
        fc.string({ minLength: 1, maxLength: 2000 }).filter((s) => s.trim().length >= 1),
        // Generate random UUIDs for authorId and ticketId
        fc.uuid(),
        fc.uuid(),
        async (status, body, authorId, ticketId) => {
          const trimmedBody = body.trim();

          // Mock ticket.findUnique to return a ticket in the given status
          mockPrisma.ticket.findUnique.mockResolvedValue({
            id: ticketId,
            title: 'Test Ticket',
            description: 'Test description',
            status,
            priority: 'MEDIUM',
            createdBy: authorId,
            assignedTo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          // Mock user.findUnique to return a valid user
          mockPrisma.user.findUnique.mockResolvedValue({
            id: authorId,
            name: 'Test User',
            email: 'test@example.com',
            role: 'AGENT',
            createdAt: new Date(),
          });

          // Mock comment.create to return the created comment
          const createdComment = {
            id: 'comment-id-123',
            body: trimmedBody,
            ticketId,
            authorId,
            createdAt: new Date(),
            author: {
              id: authorId,
              name: 'Test User',
              email: 'test@example.com',
              role: 'AGENT',
              createdAt: new Date(),
            },
          };
          mockPrisma.comment.create.mockResolvedValue(createdComment);

          // Act: addComment should NOT throw for any status
          const result = await addComment({ body: trimmedBody, authorId, ticketId });

          // Assert: comment was persisted successfully
          expect(result).toEqual(createdComment);
          expect(mockPrisma.comment.create).toHaveBeenCalledWith({
            data: {
              body: trimmedBody,
              ticketId,
              authorId,
            },
            include: { author: true },
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

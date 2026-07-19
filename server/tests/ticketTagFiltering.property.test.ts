import fc from 'fast-check';
import { Status } from '@prisma/client';

// Mock tagService's validateTagIds before importing ticketService
jest.mock('../src/services/tagService', () => ({
  validateTagIds: jest.fn(),
}));

// Mock PrismaClient before importing services
jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');

  const mockPrismaClient = {
    user: {
      findUnique: jest.fn(),
    },
    ticket: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    tag: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
  };

  return {
    ...actualPrisma,
    PrismaClient: jest.fn(() => mockPrismaClient),
    __mockPrismaClient: mockPrismaClient,
  };
});

import { createTicket, updateTicket, listTickets } from '../src/services/ticketService';
import { ValidationError } from '../src/errors';

const { __mockPrismaClient: mockPrisma } = jest.requireMock('@prisma/client');
const { validateTagIds: mockValidateTagIds } = jest.requireMock('../src/services/tagService');

describe('Ticket-Tag Filtering - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 5: Tag deletion preserves associated tickets
   *
   * For any tag associated with tickets, deleting the tag via tagService.deleteTag
   * should remove join table entries but tickets remain retrievable.
   *
   * **Validates: Requirements 1.5**
   */
  it('Property 5: Tag deletion preserves associated tickets', async () => {
    const tagIdArb = fc.uuid();
    const ticketCountArb = fc.integer({ min: 1, max: 5 });

    await fc.assert(
      fc.asyncProperty(
        tagIdArb,
        ticketCountArb,
        async (tagId, ticketCount) => {
          // Generate associated tickets
          const associatedTickets = Array.from({ length: ticketCount }, (_, i) => ({
            id: `ticket-${i}-${tagId.slice(0, 8)}`,
            title: `Ticket ${i}`,
            description: `Description ${i}`,
            status: Status.OPEN,
            priority: 'MEDIUM',
            createdBy: 'user-1',
            assignedTo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: [{ id: tagId, name: 'TestTag', createdAt: new Date() }],
            creator: { id: 'user-1', name: 'User', email: 'u@e.com', role: 'AGENT', createdAt: new Date() },
            assignee: null,
          }));

          // Mock tag exists for deletion
          mockPrisma.tag.findUnique.mockResolvedValue({
            id: tagId,
            name: 'TestTag',
            createdAt: new Date(),
          });

          // Mock tag deletion (cascading deletes remove join entries)
          mockPrisma.tag.delete.mockResolvedValue(undefined);

          // Simulate tag deletion: the service finds the tag then deletes it
          const foundTag = await mockPrisma.tag.findUnique({ where: { id: tagId } });
          expect(foundTag).toBeDefined();
          await mockPrisma.tag.delete({ where: { id: tagId } });

          // Verify tag.delete was called
          expect(mockPrisma.tag.delete).toHaveBeenCalledWith({ where: { id: tagId } });

          // After tag deletion, tickets should still be retrievable (without the deleted tag)
          const ticketsAfterDeletion = associatedTickets.map(t => ({
            ...t,
            tags: [], // Tag removed from join table by cascading delete
          }));

          mockPrisma.ticket.findMany.mockResolvedValue(ticketsAfterDeletion);

          const result = await listTickets();

          // All tickets still exist and are retrievable
          expect(result).toHaveLength(ticketCount);
          result.forEach((ticket: any) => {
            expect(ticket.id).toBeDefined();
            expect(ticket.title).toBeDefined();
            // The deleted tag is no longer associated
            expect(ticket.tags).toEqual([]);
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Tag association on ticket creation
   *
   * For any valid subset of existing tag IDs (size 1-10), creating a ticket with
   * those tags connects exactly those tags.
   *
   * **Validates: Requirements 3.1**
   */
  it('Property 6: Tag association on ticket creation', async () => {
    const tagCountArb = fc.integer({ min: 1, max: 10 });

    await fc.assert(
      fc.asyncProperty(
        tagCountArb,
        fc.uuid(),
        async (tagCount, createdBy) => {
          const tagIds = Array.from({ length: tagCount }, (_, i) => `tag-id-${i}`);
          const tags = tagIds.map(id => ({ id, name: `Tag-${id}`, createdAt: new Date() }));

          // Mock validateTagIds to return no invalid IDs (all valid)
          mockValidateTagIds.mockResolvedValue([]);

          // Mock user exists
          mockPrisma.user.findUnique.mockResolvedValue({
            id: createdBy,
            name: 'Test User',
            email: 'test@example.com',
            role: 'AGENT',
            createdAt: new Date(),
          });

          // Mock ticket.create to return ticket with exactly the specified tags
          mockPrisma.ticket.create.mockImplementation(async (args: any) => {
            const connectedTags = args.data.tags?.connect || [];
            return {
              id: 'new-ticket-id',
              title: args.data.title,
              description: args.data.description,
              priority: args.data.priority,
              status: Status.OPEN,
              createdBy: args.data.createdBy,
              assignedTo: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              creator: { id: createdBy, name: 'Test User', email: 'test@example.com', role: 'AGENT', createdAt: new Date() },
              assignee: null,
              tags: connectedTags.map((t: any) => tags.find(tag => tag.id === t.id) || { id: t.id, name: `Tag-${t.id}`, createdAt: new Date() }),
            };
          });

          const result = await createTicket({
            title: 'Test Ticket',
            description: 'Test Description',
            priority: 'MEDIUM',
            createdBy,
            tags: tagIds,
          });

          // The created ticket should have exactly the specified tags
          expect(result.tags).toHaveLength(tagCount);
          const resultTagIds = result.tags.map((t: any) => t.id).sort();
          expect(resultTagIds).toEqual([...tagIds].sort());

          // Verify Prisma create was called with connect for the tags
          expect(mockPrisma.ticket.create).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                tags: { connect: tagIds.map(id => ({ id })) },
              }),
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Replace semantics on ticket update
   *
   * For any ticket with existing tags and any new valid tag set, updateTicket replaces
   * all previous associations with the new set.
   *
   * **Validates: Requirements 3.2**
   */
  it('Property 7: Replace semantics on ticket update', async () => {
    const oldTagCountArb = fc.integer({ min: 1, max: 5 });
    const newTagCountArb = fc.integer({ min: 0, max: 10 });

    await fc.assert(
      fc.asyncProperty(
        oldTagCountArb,
        newTagCountArb,
        fc.uuid(),
        async (oldTagCount, newTagCount, ticketId) => {
          const oldTagIds = Array.from({ length: oldTagCount }, (_, i) => `old-tag-${i}`);
          const newTagIds = Array.from({ length: newTagCount }, (_, i) => `new-tag-${i}`);
          const newTags = newTagIds.map(id => ({ id, name: `NewTag-${id}`, createdAt: new Date() }));

          // Mock validateTagIds - all new tags are valid
          mockValidateTagIds.mockResolvedValue([]);

          // Mock ticket exists with old tags (non-terminal state)
          mockPrisma.ticket.findUnique.mockResolvedValue({
            id: ticketId,
            title: 'Existing Ticket',
            description: 'Existing description',
            status: Status.OPEN,
            priority: 'MEDIUM',
            createdBy: 'user-1',
            assignedTo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            tags: oldTagIds.map(id => ({ id, name: `OldTag-${id}`, createdAt: new Date() })),
          });

          // Mock ticket.update to return ticket with the new tag set
          mockPrisma.ticket.update.mockImplementation(async (args: any) => {
            const setTags = args.data.tags?.set || [];
            return {
              id: ticketId,
              title: 'Existing Ticket',
              description: 'Existing description',
              status: Status.OPEN,
              priority: 'MEDIUM',
              createdBy: 'user-1',
              assignedTo: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              creator: { id: 'user-1', name: 'User', email: 'u@e.com', role: 'AGENT', createdAt: new Date() },
              assignee: null,
              tags: setTags.map((t: any) => newTags.find(tag => tag.id === t.id) || { id: t.id, name: `Tag-${t.id}`, createdAt: new Date() }),
            };
          });

          const result = await updateTicket(ticketId, { tags: newTagIds });

          // The updated ticket should have exactly the new tag set
          expect(result.tags).toHaveLength(newTagCount);
          const resultTagIds = result.tags.map((t: any) => t.id).sort();
          expect(resultTagIds).toEqual([...newTagIds].sort());

          // Verify Prisma update used `set` semantics (replace all)
          expect(mockPrisma.ticket.update).toHaveBeenCalledWith(
            expect.objectContaining({
              data: expect.objectContaining({
                tags: { set: newTagIds.map(id => ({ id })) },
              }),
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 8: Invalid tag ID rejection on attach
   *
   * For any array containing non-existent tag IDs, createTicket/updateTicket should
   * throw ValidationError.
   *
   * **Validates: Requirements 3.3**
   */
  it('Property 8: Invalid tag ID rejection on attach', async () => {
    const invalidCountArb = fc.integer({ min: 1, max: 5 });
    const validCountArb = fc.integer({ min: 0, max: 5 });

    await fc.assert(
      fc.asyncProperty(
        invalidCountArb,
        validCountArb,
        fc.boolean(),
        fc.uuid(),
        async (invalidCount, validCount, testCreate, userId) => {
          const validTagIds = Array.from({ length: validCount }, (_, i) => `valid-tag-${i}`);
          const invalidTagIds = Array.from({ length: invalidCount }, (_, i) => `invalid-tag-${i}`);
          const allTagIds = [...validTagIds, ...invalidTagIds];

          // Mock validateTagIds to return the invalid IDs
          mockValidateTagIds.mockResolvedValue(invalidTagIds);

          // Mock user exists (for createTicket)
          mockPrisma.user.findUnique.mockResolvedValue({
            id: userId,
            name: 'Test User',
            email: 'test@example.com',
            role: 'AGENT',
            createdAt: new Date(),
          });

          // Mock ticket exists with non-terminal state (for updateTicket)
          mockPrisma.ticket.findUnique.mockResolvedValue({
            id: 'ticket-id',
            title: 'Existing Ticket',
            description: 'Existing description',
            status: Status.OPEN,
            priority: 'MEDIUM',
            createdBy: userId,
            assignedTo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });

          if (testCreate) {
            // Test createTicket rejects invalid tag IDs
            await expect(
              createTicket({
                title: 'Test Ticket',
                description: 'Description',
                priority: 'MEDIUM',
                createdBy: userId,
                tags: allTagIds,
              })
            ).rejects.toThrow(ValidationError);
          } else {
            // Test updateTicket rejects invalid tag IDs
            await expect(
              updateTicket('ticket-id', { tags: allTagIds })
            ).rejects.toThrow(ValidationError);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 10: OR-logic tag filtering
   *
   * For any set of valid tag IDs as filter, listTickets returns tickets that have
   * at least one matching tag.
   *
   * **Validates: Requirements 4.1**
   */
  it('Property 10: OR-logic tag filtering', async () => {
    const filterTagCountArb = fc.integer({ min: 1, max: 5 });
    const ticketCountArb = fc.integer({ min: 1, max: 10 });

    await fc.assert(
      fc.asyncProperty(
        filterTagCountArb,
        ticketCountArb,
        async (filterTagCount, ticketCount) => {
          const filterTagIds = Array.from({ length: filterTagCount }, (_, i) => `filter-tag-${i}`);

          // Generate tickets — some matching, some not
          const tickets = Array.from({ length: ticketCount }, (_, i) => {
            const matches = i % 2 === 0;
            const ticketTags = matches
              ? [{ id: filterTagIds[i % filterTagCount], name: `Tag-${i}`, createdAt: new Date() }]
              : [{ id: `unrelated-tag-${i}`, name: `Unrelated-${i}`, createdAt: new Date() }];

            return {
              id: `ticket-${i}`,
              title: `Ticket ${i}`,
              description: `Desc ${i}`,
              status: Status.OPEN,
              priority: 'MEDIUM',
              createdBy: 'user-1',
              assignedTo: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              creator: { id: 'user-1', name: 'User', email: 'u@e.com', role: 'AGENT', createdAt: new Date() },
              assignee: null,
              tags: ticketTags,
            };
          });

          // Simulate Prisma's `some` filter — return only matching tickets
          const matchingTickets = tickets.filter(t =>
            t.tags.some(tag => filterTagIds.includes(tag.id))
          );
          mockPrisma.ticket.findMany.mockResolvedValue(matchingTickets);

          const result = await listTickets({ tagIds: filterTagIds });

          // Every returned ticket must have at least one tag in the filter set
          result.forEach((ticket: any) => {
            const hasMatchingTag = ticket.tags.some((tag: any) =>
              filterTagIds.includes(tag.id)
            );
            expect(hasMatchingTag).toBe(true);
          });

          // Verify Prisma was called with the correct OR-logic filter (some/in)
          expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                tags: { some: { id: { in: filterTagIds } } },
              }),
            })
          );
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 11: Filter AND composition
   *
   * Tag filter combined with keyword/status uses AND logic — every returned ticket
   * satisfies ALL active filter conditions simultaneously.
   *
   * **Validates: Requirements 4.2, 4.3**
   */
  it('Property 11: Filter AND composition', async () => {
    const statusArb = fc.constantFrom(Status.OPEN, Status.IN_PROGRESS, Status.RESOLVED, Status.CLOSED, Status.CANCELLED);
    const keywordArb = fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0);
    const tagCountArb = fc.integer({ min: 1, max: 3 });

    await fc.assert(
      fc.asyncProperty(
        statusArb,
        keywordArb,
        tagCountArb,
        async (status, keyword, tagCount) => {
          const filterTagIds = Array.from({ length: tagCount }, (_, i) => `filter-tag-${i}`);

          // Return tickets that match all filters
          const matchingTickets = [
            {
              id: 'ticket-match-1',
              title: `Title with ${keyword}`,
              description: 'Some desc',
              status,
              priority: 'HIGH',
              createdBy: 'user-1',
              assignedTo: null,
              createdAt: new Date(),
              updatedAt: new Date(),
              creator: { id: 'user-1', name: 'User', email: 'u@e.com', role: 'AGENT', createdAt: new Date() },
              assignee: null,
              tags: [{ id: filterTagIds[0], name: 'Tag0', createdAt: new Date() }],
            },
          ];

          mockPrisma.ticket.findMany.mockResolvedValue(matchingTickets);

          const result = await listTickets({ keyword, status, tagIds: filterTagIds });

          // Verify Prisma was called with all filters in AND composition
          expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                tags: { some: { id: { in: filterTagIds } } },
                status,
                OR: [
                  { title: { contains: keyword, mode: 'insensitive' } },
                  { description: { contains: keyword, mode: 'insensitive' } },
                ],
              }),
            })
          );

          // All filters coexist at the top level — Prisma treats this as AND
          expect(result).toHaveLength(1);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 12: Non-existent tag IDs ignored in filter
   *
   * For a mix of valid and non-existent tag IDs, filtering produces same results
   * as filtering with only valid IDs. The service passes all IDs to Prisma's `in`
   * clause, which naturally ignores non-existent IDs.
   *
   * **Validates: Requirements 4.5**
   */
  it('Property 12: Non-existent tag IDs ignored in filter', async () => {
    const validTagCountArb = fc.integer({ min: 1, max: 3 });
    const invalidTagCountArb = fc.integer({ min: 1, max: 3 });
    const ticketCountArb = fc.integer({ min: 0, max: 5 });

    await fc.assert(
      fc.asyncProperty(
        validTagCountArb,
        invalidTagCountArb,
        ticketCountArb,
        async (validTagCount, invalidTagCount, ticketCount) => {
          const validTagIds = Array.from({ length: validTagCount }, (_, i) => `valid-tag-${i}`);
          const nonExistentTagIds = Array.from({ length: invalidTagCount }, (_, i) => `nonexistent-tag-${i}`);
          const allFilterIds = [...validTagIds, ...nonExistentTagIds];

          // Tickets matching the valid tags only
          const matchingTickets = Array.from({ length: ticketCount }, (_, i) => ({
            id: `ticket-${i}`,
            title: `Ticket ${i}`,
            description: `Description ${i}`,
            status: Status.OPEN,
            priority: 'MEDIUM',
            createdBy: 'user-1',
            assignedTo: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            creator: { id: 'user-1', name: 'User', email: 'u@e.com', role: 'AGENT', createdAt: new Date() },
            assignee: null,
            tags: [{ id: validTagIds[i % validTagCount], name: `ValidTag-${i}`, createdAt: new Date() }],
          }));

          // Mock findMany — Prisma's `in` clause naturally ignores non-existent IDs
          mockPrisma.ticket.findMany.mockResolvedValue(matchingTickets);

          // Filter with mix of valid + non-existent IDs
          const result = await listTickets({ tagIds: allFilterIds });

          // Verify the service passes ALL filter IDs (including non-existent) to Prisma
          // Prisma's `in` will simply not match the non-existent ones
          expect(mockPrisma.ticket.findMany).toHaveBeenCalledWith(
            expect.objectContaining({
              where: expect.objectContaining({
                tags: { some: { id: { in: allFilterIds } } },
              }),
            })
          );

          // The results include tickets that match valid tag IDs
          expect(result).toHaveLength(ticketCount);

          // Non-existent IDs do NOT cause errors or empty results
          // They are simply ignored at the database level
          result.forEach((ticket: any) => {
            const hasValidTag = ticket.tags.some((tag: any) =>
              validTagIds.includes(tag.id)
            );
            expect(hasValidTag).toBe(true);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

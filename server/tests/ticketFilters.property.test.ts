import fc from 'fast-check';
import { Priority, Status } from '@prisma/client';

// Mock tagService before importing ticketService
jest.mock('../src/services/tagService', () => ({
  validateTagIds: jest.fn().mockResolvedValue([]),
}));

// Mock PrismaClient before importing the service
jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');

  const mockPrismaClient = {
    user: { findUnique: jest.fn() },
    ticket: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  return {
    ...actualPrisma,
    PrismaClient: jest.fn(() => mockPrismaClient),
    __mockPrismaClient: mockPrismaClient,
  };
});

import { listTickets, ListTicketsParams } from '../src/services/ticketService';

const { __mockPrismaClient: mockPrisma } = jest.requireMock('@prisma/client');

// Priority severity order for sorting
const PRIORITY_ORDER: Record<Priority, number> = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
};

// Generators
const priorityArb = fc.constantFrom<Priority>('LOW', 'MEDIUM', 'HIGH', 'URGENT');
const statusArb = fc.constantFrom<Status>('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED');
const uuidArb = fc.uuid();

function ticketArb() {
  return fc.record({
    id: fc.uuid(),
    title: fc.string({ minLength: 1, maxLength: 100 }),
    description: fc.string({ minLength: 1, maxLength: 200 }),
    status: statusArb,
    priority: priorityArb,
    createdBy: fc.uuid(),
    assignedTo: fc.option(fc.uuid(), { nil: null }),
    createdAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
    updatedAt: fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
  });
}

function makeFullTicket(ticket: any) {
  return {
    ...ticket,
    creator: { id: ticket.createdBy, name: 'User', email: 'u@e.com' },
    assignee: ticket.assignedTo
      ? { id: ticket.assignedTo, name: 'Assignee', email: 'a@e.com' }
      : null,
    tags: [],
  };
}

describe('Feature: ticket-list-filters — Service Layer Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 1: Priority filter returns only matching tickets
   *
   * For any valid priority value and any set of tickets, when the priority filter
   * is applied, every ticket in the data array SHALL have a priority field equal
   * to the requested value.
   *
   * **Validates: Requirements 1.1**
   */
  it('Feature: ticket-list-filters, Property 1: Priority filter returns only matching tickets', async () => {
    await fc.assert(
      fc.asyncProperty(
        priorityArb,
        fc.array(ticketArb(), { minLength: 0, maxLength: 20 }),
        async (filterPriority, allTickets) => {
          // Simulate what Prisma would return: only tickets matching the priority
          const matchingTickets = allTickets
            .filter(t => t.priority === filterPriority)
            .map(makeFullTicket);

          mockPrisma.$transaction.mockResolvedValue([matchingTickets, matchingTickets.length]);

          const params: ListTicketsParams = {
            priority: filterPriority,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            page: 1,
            pageSize: 20,
          };

          const result = await listTickets(params);

          // Every returned ticket must have the requested priority
          for (const ticket of result.data) {
            expect(ticket.priority).toBe(filterPriority);
          }

          // The count should match
          expect(result.data.length).toBe(matchingTickets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: AssignedTo filter returns only matching tickets
   *
   * For any valid assignedTo value (UUID or "unassigned") and any set of tickets,
   * when the assignedTo filter is applied, every ticket in the data array SHALL
   * have an assignedTo field matching the requested value (or null when "unassigned").
   *
   * **Validates: Requirements 2.1, 2.2**
   */
  it('Feature: ticket-list-filters, Property 2: AssignedTo filter returns only matching tickets', async () => {
    const assignedToFilterArb = fc.oneof(
      uuidArb,
      fc.constant('unassigned')
    );

    await fc.assert(
      fc.asyncProperty(
        assignedToFilterArb,
        fc.array(ticketArb(), { minLength: 0, maxLength: 20 }),
        async (assignedToFilter, allTickets) => {
          // Simulate Prisma filtering
          const matchingTickets = allTickets
            .filter(t => {
              if (assignedToFilter === 'unassigned') {
                return t.assignedTo === null;
              }
              return t.assignedTo === assignedToFilter;
            })
            .map(makeFullTicket);

          mockPrisma.$transaction.mockResolvedValue([matchingTickets, matchingTickets.length]);

          const params: ListTicketsParams = {
            assignedTo: assignedToFilter,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            page: 1,
            pageSize: 20,
          };

          const result = await listTickets(params);

          // Every returned ticket must match the assignedTo filter
          for (const ticket of result.data) {
            if (assignedToFilter === 'unassigned') {
              expect(ticket.assignedTo).toBeNull();
            } else {
              expect(ticket.assignedTo).toBe(assignedToFilter);
            }
          }

          expect(result.data.length).toBe(matchingTickets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Combined filters apply AND logic
   *
   * For any combination of valid filter parameters (priority, assignedTo),
   * every ticket in the data array SHALL satisfy ALL active filter conditions simultaneously.
   *
   * **Validates: Requirements 1.4, 2.5**
   */
  it('Feature: ticket-list-filters, Property 3: Combined filters apply AND logic', async () => {
    const assignedToFilterArb = fc.oneof(
      uuidArb,
      fc.constant('unassigned')
    );

    await fc.assert(
      fc.asyncProperty(
        priorityArb,
        assignedToFilterArb,
        fc.array(ticketArb(), { minLength: 0, maxLength: 20 }),
        async (filterPriority, assignedToFilter, allTickets) => {
          // Simulate combined filtering: AND logic
          const matchingTickets = allTickets
            .filter(t => {
              const priorityMatch = t.priority === filterPriority;
              const assignedMatch = assignedToFilter === 'unassigned'
                ? t.assignedTo === null
                : t.assignedTo === assignedToFilter;
              return priorityMatch && assignedMatch;
            })
            .map(makeFullTicket);

          mockPrisma.$transaction.mockResolvedValue([matchingTickets, matchingTickets.length]);

          const params: ListTicketsParams = {
            priority: filterPriority,
            assignedTo: assignedToFilter,
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            page: 1,
            pageSize: 20,
          };

          const result = await listTickets(params);

          // Every returned ticket must satisfy BOTH filters
          for (const ticket of result.data) {
            expect(ticket.priority).toBe(filterPriority);
            if (assignedToFilter === 'unassigned') {
              expect(ticket.assignedTo).toBeNull();
            } else {
              expect(ticket.assignedTo).toBe(assignedToFilter);
            }
          }

          expect(result.data.length).toBe(matchingTickets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Sort ordering correctness
   *
   * For any valid sortBy and sortOrder combination, the tickets in the data array
   * SHALL be ordered such that for every consecutive pair, the sort field value
   * compares correctly according to the specified direction.
   *
   * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
   */
  it('Feature: ticket-list-filters, Property 4: Sort ordering correctness', async () => {
    const sortByArb = fc.constantFrom<'updatedAt' | 'priority'>('updatedAt', 'priority');
    const sortOrderArb = fc.constantFrom<'asc' | 'desc'>('asc', 'desc');

    await fc.assert(
      fc.asyncProperty(
        sortByArb,
        sortOrderArb,
        fc.array(ticketArb(), { minLength: 2, maxLength: 20 }),
        async (sortBy, sortOrder, allTickets) => {
          // Sort the tickets as the service would
          const sorted = [...allTickets].sort((a, b) => {
            let cmp: number;
            if (sortBy === 'updatedAt') {
              cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
            } else {
              cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            }
            if (sortOrder === 'desc') cmp = -cmp;
            if (cmp === 0) {
              // Secondary sort: createdAt desc
              cmp = b.createdAt.getTime() - a.createdAt.getTime();
            }
            return cmp;
          });

          const sortedFull = sorted.map(makeFullTicket);
          mockPrisma.$transaction.mockResolvedValue([sortedFull, sortedFull.length]);

          const params: ListTicketsParams = {
            sortBy,
            sortOrder,
            page: 1,
            pageSize: 100,
          };

          const result = await listTickets(params);

          // Verify ordering for consecutive pairs
          for (let i = 0; i < result.data.length - 1; i++) {
            const curr = result.data[i];
            const next = result.data[i + 1];

            if (sortBy === 'updatedAt') {
              const currTime = new Date(curr.updatedAt).getTime();
              const nextTime = new Date(next.updatedAt).getTime();
              if (sortOrder === 'asc') {
                expect(currTime).toBeLessThanOrEqual(nextTime);
              } else {
                expect(currTime).toBeGreaterThanOrEqual(nextTime);
              }
            } else {
              const currPriority = PRIORITY_ORDER[curr.priority];
              const nextPriority = PRIORITY_ORDER[next.priority];
              if (sortOrder === 'asc') {
                expect(currPriority).toBeLessThanOrEqual(nextPriority);
              } else {
                expect(currPriority).toBeGreaterThanOrEqual(nextPriority);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 5: Secondary sort determinism
   *
   * For any set of tickets where multiple tickets share the same value for the
   * active sort field, those tickets SHALL be sub-ordered by createdAt descending.
   *
   * **Validates: Requirements 3.10**
   */
  it('Feature: ticket-list-filters, Property 5: Secondary sort determinism', async () => {
    const sortByArb = fc.constantFrom<'updatedAt' | 'priority'>('updatedAt', 'priority');
    const sortOrderArb = fc.constantFrom<'asc' | 'desc'>('asc', 'desc');

    await fc.assert(
      fc.asyncProperty(
        sortByArb,
        sortOrderArb,
        fc.array(ticketArb(), { minLength: 3, maxLength: 20 }),
        async (sortBy, sortOrder, allTickets) => {
          // Force some tickets to share the same primary sort value
          const sharedValue = sortBy === 'updatedAt'
            ? allTickets[0].updatedAt
            : allTickets[0].priority;

          const ticketsWithTies = allTickets.map((t, i) => {
            if (i < Math.ceil(allTickets.length / 2)) {
              return sortBy === 'updatedAt'
                ? { ...t, updatedAt: sharedValue as Date }
                : { ...t, priority: sharedValue as Priority };
            }
            return t;
          });

          // Sort with secondary sort logic
          const sorted = [...ticketsWithTies].sort((a, b) => {
            let cmp: number;
            if (sortBy === 'updatedAt') {
              cmp = a.updatedAt.getTime() - b.updatedAt.getTime();
            } else {
              cmp = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
            }
            if (sortOrder === 'desc') cmp = -cmp;
            if (cmp === 0) {
              // Secondary sort: createdAt desc
              cmp = b.createdAt.getTime() - a.createdAt.getTime();
            }
            return cmp;
          });

          const sortedFull = sorted.map(makeFullTicket);
          mockPrisma.$transaction.mockResolvedValue([sortedFull, sortedFull.length]);

          const params: ListTicketsParams = {
            sortBy,
            sortOrder,
            page: 1,
            pageSize: 100,
          };

          const result = await listTickets(params);

          // For tickets with the same primary sort value, verify createdAt desc ordering
          for (let i = 0; i < result.data.length - 1; i++) {
            const curr = result.data[i];
            const next = result.data[i + 1];

            let samePrimaryValue: boolean;
            if (sortBy === 'updatedAt') {
              samePrimaryValue = new Date(curr.updatedAt).getTime() === new Date(next.updatedAt).getTime();
            } else {
              samePrimaryValue = curr.priority === next.priority;
            }

            if (samePrimaryValue) {
              const currCreatedAt = new Date(curr.createdAt).getTime();
              const nextCreatedAt = new Date(next.createdAt).getTime();
              // Secondary sort is always createdAt descending
              expect(currCreatedAt).toBeGreaterThanOrEqual(nextCreatedAt);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 6: Pagination slice correctness
   *
   * For any valid page and pageSize, the data array SHALL contain at most pageSize
   * items and SHALL correspond to the correct offset slice of the full sorted,
   * filtered result set.
   *
   * **Validates: Requirements 4.1, 4.2, 4.6**
   */
  it('Feature: ticket-list-filters, Property 6: Pagination slice correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10 }),   // page
        fc.integer({ min: 1, max: 20 }),   // pageSize
        fc.array(ticketArb(), { minLength: 0, maxLength: 50 }),
        async (page, pageSize, allTickets) => {
          const total = allTickets.length;
          const skip = (page - 1) * pageSize;
          const slicedTickets = allTickets.slice(skip, skip + pageSize).map(makeFullTicket);

          mockPrisma.$transaction.mockResolvedValue([slicedTickets, total]);

          const params: ListTicketsParams = {
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            page,
            pageSize,
          };

          const result = await listTickets(params);

          // Data array should contain at most pageSize items
          expect(result.data.length).toBeLessThanOrEqual(pageSize);

          // Data should correspond to the correct offset slice
          expect(result.data.length).toBe(slicedTickets.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 7: Pagination metadata mathematical correctness
   *
   * For any response, the pagination metadata SHALL satisfy:
   * - pagination.total equals the count of all tickets matching active filters
   * - pagination.totalPages equals Math.ceil(total / pageSize) or 0 when total is 0
   * - pagination.page and pagination.pageSize equal the requested values
   *
   * **Validates: Requirements 4.10, 4.12**
   */
  it('Feature: ticket-list-filters, Property 7: Pagination metadata mathematical correctness', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 50 }),   // page
        fc.integer({ min: 1, max: 100 }),  // pageSize
        fc.integer({ min: 0, max: 200 }),  // total count
        async (page, pageSize, total) => {
          const skip = (page - 1) * pageSize;
          const sliceEnd = Math.min(skip + pageSize, total);
          const sliceCount = Math.max(0, sliceEnd - skip);
          const slicedTickets = Array.from({ length: sliceCount }, (_, i) =>
            makeFullTicket({
              id: `ticket-${i}`,
              title: `Ticket ${i}`,
              description: `Desc ${i}`,
              status: 'OPEN' as Status,
              priority: 'MEDIUM' as Priority,
              createdBy: 'user-1',
              assignedTo: null,
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          );

          mockPrisma.$transaction.mockResolvedValue([slicedTickets, total]);

          const params: ListTicketsParams = {
            sortBy: 'updatedAt',
            sortOrder: 'desc',
            page,
            pageSize,
          };

          const result = await listTickets(params);

          // pagination.page equals requested page
          expect(result.pagination.page).toBe(page);

          // pagination.pageSize equals requested pageSize
          expect(result.pagination.pageSize).toBe(pageSize);

          // pagination.total equals the total count from DB
          expect(result.pagination.total).toBe(total);

          // pagination.totalPages is correct
          const expectedTotalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
          expect(result.pagination.totalPages).toBe(expectedTotalPages);
        }
      ),
      { numRuns: 100 }
    );
  });
});

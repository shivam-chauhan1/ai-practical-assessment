import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { listTickets } from '../src/api/tickets';
import type { PaginatedTicketsResponse } from '../src/api/types';

/**
 * Property 9: Tag inclusion in ticket responses
 * Validates: Requirements 5.2
 *
 * Verifies that listTickets correctly constructs the URL with a comma-separated
 * tag query parameter for any set of valid UUIDs.
 */

const mockPaginatedResponse: PaginatedTicketsResponse = {
  data: [],
  pagination: {
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0,
  },
};

describe('Feature: ticket-tagging, Property 9: Tag inclusion in ticket responses', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPaginatedResponse),
    } as unknown as Response);
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  const uuidArb = fc.uuid({ version: 4 });

  it('should include comma-separated tag IDs in URL query param for any set of valid UUIDs', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(uuidArb, { minLength: 1, maxLength: 10 }),
        async (uuids) => {
          fetchSpy.mockClear();

          const tagParam = uuids.join(',');
          await listTickets({ tag: tagParam });

          expect(fetchSpy).toHaveBeenCalledTimes(1);
          const calledUrl: string = fetchSpy.mock.calls[0][0];
          const url = new URL(calledUrl, 'http://localhost');
          const tagValue = url.searchParams.get('tag');

          expect(tagValue).toBe(tagParam);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should NOT include tag param in URL when tag is undefined', async () => {
    await listTickets({});

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.has('tag')).toBe(false);
  });

  it('should NOT include tag param in URL when tag is empty string', async () => {
    await listTickets({ tag: '' });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.has('tag')).toBe(false);
  });

  it('should NOT include tag param in URL when no params are provided', async () => {
    await listTickets();

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.has('tag')).toBe(false);
  });
});

/**
 * Feature: ticket-list-filters — Client API serialization tests
 * Validates: Requirements 5.1, 5.2
 *
 * Verifies that the listTickets client function correctly serializes
 * new TicketListParams fields to query string and returns the full
 * PaginatedTicketsResponse envelope.
 */
describe('Feature: ticket-list-filters, Client API serialization', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockPaginatedResponse),
    } as unknown as Response);
    globalThis.fetch = fetchSpy;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should serialize priority param to query string', async () => {
    await listTickets({ priority: 'HIGH' });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('priority')).toBe('HIGH');
  });

  it('should serialize assignedTo param to query string', async () => {
    const userId = '550e8400-e29b-41d4-a716-446655440000';
    await listTickets({ assignedTo: userId });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('assignedTo')).toBe(userId);
  });

  it('should serialize assignedTo=unassigned to query string', async () => {
    await listTickets({ assignedTo: 'unassigned' });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('assignedTo')).toBe('unassigned');
  });

  it('should serialize sortBy param to query string', async () => {
    await listTickets({ sortBy: 'priority' });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('sortBy')).toBe('priority');
  });

  it('should serialize sortOrder param to query string', async () => {
    await listTickets({ sortOrder: 'asc' });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('sortOrder')).toBe('asc');
  });

  it('should serialize sortBy and sortOrder together to query string', async () => {
    await listTickets({ sortBy: 'updatedAt', sortOrder: 'desc' });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('sortBy')).toBe('updatedAt');
    expect(url.searchParams.get('sortOrder')).toBe('desc');
  });

  it('should serialize page as string in query string', async () => {
    await listTickets({ page: 3 });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('page')).toBe('3');
  });

  it('should serialize pageSize as string in query string', async () => {
    await listTickets({ pageSize: 50 });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('pageSize')).toBe('50');
  });

  it('should serialize page and pageSize together as strings in query string', async () => {
    await listTickets({ page: 2, pageSize: 10 });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('10');
  });

  it('should not include params that are undefined', async () => {
    await listTickets({ priority: 'LOW' });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.has('priority')).toBe(true);
    expect(url.searchParams.has('assignedTo')).toBe(false);
    expect(url.searchParams.has('sortBy')).toBe(false);
    expect(url.searchParams.has('sortOrder')).toBe(false);
    expect(url.searchParams.has('page')).toBe(false);
    expect(url.searchParams.has('pageSize')).toBe(false);
  });

  it('should return the full PaginatedTicketsResponse envelope', async () => {
    const responseWithData: PaginatedTicketsResponse = {
      data: [
        {
          id: '123',
          title: 'Test ticket',
          description: 'Description',
          status: 'OPEN',
          priority: 'HIGH',
          createdBy: 'user-1',
          assignedTo: null,
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:00:00.000Z',
          validTransitions: ['IN_PROGRESS', 'CANCELLED'],
          creator: { id: 'user-1', name: 'Test User', email: 'test@test.com', role: 'AGENT', createdAt: '2024-01-01T00:00:00.000Z' },
          assignee: null,
          tags: [],
        },
      ],
      pagination: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1,
      },
    };

    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(responseWithData),
    } as unknown as Response);

    const result = await listTickets();

    expect(result).toEqual(responseWithData);
    expect(result.data).toHaveLength(1);
    expect(result.pagination.page).toBe(1);
    expect(result.pagination.pageSize).toBe(20);
    expect(result.pagination.total).toBe(1);
    expect(result.pagination.totalPages).toBe(1);
  });

  it('should serialize all params together in a combined request', async () => {
    await listTickets({
      keyword: 'bug',
      status: 'OPEN',
      tag: 'tag-1',
      priority: 'URGENT',
      assignedTo: '550e8400-e29b-41d4-a716-446655440000',
      sortBy: 'priority',
      sortOrder: 'asc',
      page: 2,
      pageSize: 25,
    });

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    const url = new URL(calledUrl, 'http://localhost');

    expect(url.searchParams.get('keyword')).toBe('bug');
    expect(url.searchParams.get('status')).toBe('OPEN');
    expect(url.searchParams.get('tag')).toBe('tag-1');
    expect(url.searchParams.get('priority')).toBe('URGENT');
    expect(url.searchParams.get('assignedTo')).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(url.searchParams.get('sortBy')).toBe('priority');
    expect(url.searchParams.get('sortOrder')).toBe('asc');
    expect(url.searchParams.get('page')).toBe('2');
    expect(url.searchParams.get('pageSize')).toBe('25');
  });
});

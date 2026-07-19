import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fc from 'fast-check';
import { listTickets } from '../src/api/tickets';

/**
 * Property 9: Tag inclusion in ticket responses
 * Validates: Requirements 5.2
 *
 * Verifies that listTickets correctly constructs the URL with a comma-separated
 * tag query parameter for any set of valid UUIDs.
 */

describe('Feature: ticket-tagging, Property 9: Tag inclusion in ticket responses', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve([]),
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

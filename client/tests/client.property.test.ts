// Feature: jwt-auth, Property 8: Authorization header presence equals token presence
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fc from 'fast-check';
import { setAuthConfig, apiRequest } from '../src/api/client';

/**
 * **Validates: Requirements 8.1, 8.2**
 *
 * Property 8: Authorization header presence equals token presence
 * For any outgoing API request to a `/api/tickets` path, the Authorization header
 * SHALL be present with value "Bearer <token>" if and only if a non-null token
 * exists in the AuthContext. When token is null, the header SHALL be absent.
 */
describe('Property 8: Authorization header presence equals token presence', () => {
  let capturedHeaders: Record<string, string> | undefined;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    capturedHeaders = undefined;

    // Mock fetch to capture request headers and return a valid JSON response
    fetchSpy = vi.fn(async (_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers as Record<string, string>;
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Reset auth config to a no-op state
    setAuthConfig(() => null, () => {});
  });

  // Arbitrary for non-empty token strings (simulates JWT-like tokens)
  const tokenArb = fc.string({ minLength: 1, maxLength: 200 });

  // Arbitrary for nullable tokens
  const nullableTokenArb = fc.oneof(
    fc.constant(null as string | null),
    tokenArb
  );

  // Arbitrary for /tickets sub-paths (e.g., /tickets, /tickets/123, /tickets/abc/comments)
  const ticketsSubPathArb = fc
    .array(fc.string({ minLength: 1, maxLength: 10 }).map((s) => s.replace(/[^a-zA-Z0-9\-_]/g, 'x')), {
      minLength: 0,
      maxLength: 3,
    })
    .map((segments) =>
      `/tickets${segments.length > 0 ? '/' + segments.join('/') : ''}`
    );

  it('attaches Authorization header if and only if token is non-null for /tickets paths', async () => {
    await fc.assert(
      fc.asyncProperty(
        nullableTokenArb,
        ticketsSubPathArb,
        async (token, path) => {
          // Configure the auth with the generated token
          setAuthConfig(() => token, () => {});

          // Make the API request
          await apiRequest(path);

          // Verify header behavior
          if (token !== null) {
            // When token is non-null, Authorization header should be present
            expect(capturedHeaders).toBeDefined();
            expect(capturedHeaders!['Authorization']).toBe(`Bearer ${token}`);
          } else {
            // When token is null, Authorization header should be absent
            expect(capturedHeaders?.['Authorization']).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

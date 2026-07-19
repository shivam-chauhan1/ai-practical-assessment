// Feature: jwt-auth, Property 7: For any authenticated AGENT, requests to non-status-PATCH ticket endpoints shall not return 403

process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/test';

import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';

const TEST_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';

/**
 * Property 7: Role restriction scoped exclusively to status PATCH
 *
 * For any authenticated user with the AGENT role, requests to any ticket endpoint
 * OTHER than PATCH /api/tickets/:id/status SHALL NOT be rejected with 403.
 * Only PATCH /api/tickets/:id/status SHALL enforce the ADMIN role requirement.
 *
 * **Validates: Requirements 5.2, 5.3, 5.4, 5.5, 5.6, 5.7**
 */
describe('Property: Role restriction scoped exclusively to status PATCH', () => {
  function generateAgentToken(userId: string, email: string): string {
    return jwt.sign(
      { id: userId, email, role: 'AGENT' },
      TEST_SECRET,
      { expiresIn: '1h' }
    );
  }

  // Define endpoint patterns that AGENT should be able to access (non-status-PATCH)
  type EndpointPattern = {
    method: 'get' | 'post' | 'patch';
    pathFn: (ticketId: string) => string;
    bodyFn: (userId: string) => Record<string, unknown> | undefined;
    label: string;
  };

  const nonStatusPatchEndpoints: EndpointPattern[] = [
    {
      method: 'get',
      pathFn: () => '/api/tickets',
      bodyFn: () => undefined,
      label: 'GET /api/tickets',
    },
    {
      method: 'get',
      pathFn: (ticketId) => `/api/tickets/${ticketId}`,
      bodyFn: () => undefined,
      label: 'GET /api/tickets/:id',
    },
    {
      method: 'post',
      pathFn: () => '/api/tickets',
      bodyFn: (userId) => ({
        title: 'Test ticket',
        description: 'A test ticket description',
        priority: 'MEDIUM',
        createdBy: userId,
      }),
      label: 'POST /api/tickets',
    },
    {
      method: 'patch',
      pathFn: (ticketId) => `/api/tickets/${ticketId}`,
      bodyFn: () => ({ title: 'Updated title' }),
      label: 'PATCH /api/tickets/:id',
    },
    {
      method: 'post',
      pathFn: (ticketId) => `/api/tickets/${ticketId}/comments`,
      bodyFn: (userId) => ({ body: 'A test comment', authorId: userId }),
      label: 'POST /api/tickets/:id/comments',
    },
  ];

  it(
    'should never return 403 for AGENT users on non-status-PATCH ticket endpoints',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(...nonStatusPatchEndpoints),
          fc.uuid(),
          fc.uuid(),
          fc.emailAddress(),
          async (endpoint, ticketId, userId, email) => {
            const token = generateAgentToken(userId, email);
            const path = endpoint.pathFn(ticketId);
            const body = endpoint.bodyFn(userId);

            let res;
            if (endpoint.method === 'get') {
              res = await request(app)
                .get(path)
                .set('Authorization', `Bearer ${token}`);
            } else if (endpoint.method === 'post') {
              res = await request(app)
                .post(path)
                .set('Authorization', `Bearer ${token}`)
                .send(body);
            } else {
              res = await request(app)
                .patch(path)
                .set('Authorization', `Bearer ${token}`)
                .send(body);
            }

            // AGENT should NEVER get 403 on non-status-PATCH endpoints
            // The actual response may be 200, 201, 400, 404, 500 etc. — that's fine
            expect(res.status).not.toBe(403);
          }
        ),
        { numRuns: 100 }
      );
    },
    120000
  );
});

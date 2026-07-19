// Feature: jwt-auth, Property 6: For any request body/query, middleware with valid token preserves req.body and req.query unchanged

import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// Mock config with known secret
const TEST_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
jest.mock('../src/config', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret-that-is-at-least-32-characters-long',
      expiresIn: '1h',
    },
  },
}));

import { authenticate } from '../src/middleware/authMiddleware';

/**
 * Property 6: Middleware preserves request body and query
 *
 * For any request body object and query parameter set, after the auth middleware
 * processes a valid token, the `req.body` and `req.query` SHALL be identical to
 * their values before middleware execution.
 *
 * **Validates: Requirements 4.7**
 */
describe('Property: Middleware preserves request body and query', () => {
  it(
    'should not modify req.body or req.query when processing a valid token',
    () => {
      fc.assert(
        fc.property(
          fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.jsonValue()),
          fc.dictionary(
            fc.string({ minLength: 1, maxLength: 20 }),
            fc.string({ minLength: 0, maxLength: 50 })
          ),
          (body, query) => {
            // Create a valid token
            const token = jwt.sign(
              { id: 'user-123', email: 'test@example.com', role: 'AGENT' },
              TEST_SECRET,
              { expiresIn: '1h' }
            );

            // Snapshot body and query before middleware execution
            const bodySnapshot = JSON.parse(JSON.stringify(body));
            const querySnapshot = JSON.parse(JSON.stringify(query));

            // Create mock request with the generated body and query
            const req = {
              headers: { authorization: `Bearer ${token}` },
              body: body,
              query: query,
            } as unknown as Request;

            const res = {} as Response;
            const next: NextFunction = jest.fn();

            // Execute middleware
            authenticate(req, res, next);

            // Verify next was called (valid token accepted)
            expect(next).toHaveBeenCalled();

            // Verify body and query are unchanged
            expect(JSON.parse(JSON.stringify(req.body))).toEqual(bodySnapshot);
            expect(JSON.parse(JSON.stringify(req.query))).toEqual(querySnapshot);
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );
});

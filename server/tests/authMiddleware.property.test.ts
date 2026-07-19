// Feature: jwt-auth, Property 4: For any valid JWT with { id, email, role } claims, middleware decodes and attaches matching values

import * as fc from 'fast-check';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long';

// Mock config with a known secret
jest.mock('../src/config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-that-is-at-least-32-characters-long',
      expiresIn: '1h',
    },
  },
}));

import { authenticate } from '../src/middleware/authMiddleware';

/**
 * Property 4: Valid token decode correctness
 *
 * For any JWT signed with the application's secret and containing { id, email, role }
 * claims that has not expired, the auth middleware decodes it and attaches an object
 * with matching id, email, and role values to the request.
 *
 * **Validates: Requirements 4.1**
 */
describe('Property: Valid token decode correctness', () => {
  it(
    'should decode any valid JWT and attach matching { id, email, role } to req.user',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constantFrom('ADMIN', 'AGENT'),
          }),
          async (payload) => {
            // Arrange: sign a real JWT with the known secret
            const token = jwt.sign(
              { id: payload.id, email: payload.email, role: payload.role },
              TEST_SECRET,
              { expiresIn: '1h' }
            );

            const req = {
              headers: {
                authorization: `Bearer ${token}`,
              },
            } as unknown as Request;

            const res = {} as Response;
            const next: NextFunction = jest.fn();

            // Act: call authenticate middleware
            authenticate(req, res, next);

            // Assert: next() was called
            expect(next).toHaveBeenCalled();

            // Assert: req.user is attached with matching values
            expect(req.user).toBeDefined();
            expect(req.user!.id).toBe(payload.id);
            expect(req.user!.email).toBe(payload.email);
            expect(req.user!.role).toBe(payload.role);
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );
});

// Feature: jwt-auth, Property 5: For any invalid token (random strings or wrong-secret tokens), middleware rejects with 401

import * as fc from 'fast-check';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticationError } from '../src/errors';

const CORRECT_SECRET = 'test-secret-that-is-at-least-32-chars-long';
const WRONG_SECRET = 'completely-different-wrong-secret-key-here';

// Mock config with known secret
jest.mock('../src/config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-that-is-at-least-32-chars-long',
      expiresIn: '1h',
    },
  },
}));

import { authenticate } from '../src/middleware/authMiddleware';

function createMockReq(token: string): Partial<Request> {
  return {
    headers: {
      authorization: `Bearer ${token}`,
    },
  } as Partial<Request>;
}

function createMockRes(): Partial<Response> {
  return {};
}

/**
 * Property 5: Invalid token rejection
 *
 * For any string that is not a validly-signed JWT (random strings, tampered tokens,
 * tokens signed with a different secret), the auth middleware SHALL reject it with a
 * 401 status and SHALL NOT attach any user object to the request.
 *
 * **Validates: Requirements 4.4**
 */
describe('Property: Invalid token rejection', () => {
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
  });

  it(
    'should reject random non-JWT strings with 401 AuthenticationError',
    () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 200 }),
          (randomString: string) => {
            const req = createMockReq(randomString);
            mockNext.mockClear();

            expect(() => {
              authenticate(req as Request, createMockRes() as Response, mockNext);
            }).toThrow(AuthenticationError);

            try {
              authenticate(req as Request, createMockRes() as Response, mockNext);
            } catch (err) {
              expect(err).toBeInstanceOf(AuthenticationError);
              expect((err as AuthenticationError).statusCode).toBe(401);
            }

            // req.user must NOT be set
            expect((req as any).user).toBeUndefined();

            // next() must NOT be called
            expect(mockNext).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    },
    30000
  );

  it(
    'should reject tokens signed with a wrong secret with 401 AuthenticationError',
    () => {
      fc.assert(
        fc.property(
          fc.record({
            id: fc.uuid(),
            email: fc.emailAddress(),
            role: fc.constantFrom('ADMIN', 'AGENT'),
          }),
          (payload) => {
            // Sign token with the WRONG secret
            const wrongToken = jwt.sign(payload, WRONG_SECRET, { expiresIn: '1h' });

            const req = createMockReq(wrongToken);
            mockNext.mockClear();

            expect(() => {
              authenticate(req as Request, createMockRes() as Response, mockNext);
            }).toThrow(AuthenticationError);

            try {
              authenticate(req as Request, createMockRes() as Response, mockNext);
            } catch (err) {
              expect(err).toBeInstanceOf(AuthenticationError);
              expect((err as AuthenticationError).statusCode).toBe(401);
              expect((err as AuthenticationError).message).toBe('Invalid token');
            }

            // req.user must NOT be set
            expect((req as any).user).toBeUndefined();

            // next() must NOT be called
            expect(mockNext).not.toHaveBeenCalled();
          }
        ),
        { numRuns: 20 }
      );
    },
    30000
  );
});

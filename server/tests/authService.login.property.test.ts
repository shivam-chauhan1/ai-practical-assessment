// Feature: jwt-auth, Property 2: For any valid user, login response user object matches decoded JWT claims

import * as fc from 'fast-check';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// Mock Prisma client
const mockFindUnique = jest.fn();
jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    user: {
      findUnique: mockFindUnique,
    },
  })),
}));

// Mock config with a known secret
const TEST_SECRET = 'test-jwt-secret-that-is-at-least-32-characters-long';
jest.mock('../src/config', () => ({
  config: {
    jwt: {
      secret: 'test-jwt-secret-that-is-at-least-32-characters-long',
      expiresIn: '1h',
    },
  },
}));

import { login } from '../src/services/authService';
import { config } from '../src/config';

/**
 * Property 2: Login token-response consistency
 *
 * For any valid user in the database, when login succeeds, the `user` object
 * in the response (id, email, role) exactly matches the corresponding claims
 * decoded from the returned JWT token.
 *
 * **Validates: Requirements 2.1, 2.7**
 */
describe('Property: Login token-response consistency', () => {
  const KNOWN_PASSWORD = 'testpass';
  let hashedPassword: string;

  beforeAll(async () => {
    // Pre-hash a known password once to keep the property test fast
    hashedPassword = await bcrypt.hash(KNOWN_PASSWORD, 10);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(
    'should produce a JWT whose decoded claims (id, email, role) match the response user object',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            id: fc.uuid(),
            email: fc.emailAddress(),
            name: fc.string({ minLength: 1, maxLength: 50 }),
            role: fc.constantFrom('ADMIN', 'AGENT'),
          }),
          async (userRecord) => {
            // Arrange: mock Prisma to return the generated user with our pre-hashed password
            mockFindUnique.mockResolvedValue({
              ...userRecord,
              password: hashedPassword,
              createdAt: new Date(),
            });

            // Act: call login with the correct password
            const result = await login(userRecord.email, KNOWN_PASSWORD);

            // Assert 1: Response user object matches input user record
            expect(result.user.id).toBe(userRecord.id);
            expect(result.user.email).toBe(userRecord.email);
            expect(result.user.role).toBe(userRecord.role);

            // Assert 2: Decode the JWT and verify claims match response user
            const decoded = jwt.verify(result.token, config.jwt.secret) as {
              id: string;
              email: string;
              role: string;
              iat: number;
              exp: number;
            };

            expect(decoded.id).toBe(result.user.id);
            expect(decoded.email).toBe(result.user.email);
            expect(decoded.role).toBe(result.user.role);
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );
});

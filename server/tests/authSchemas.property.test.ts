// Feature: jwt-auth, Property 3: For any non-email string, login returns 400 not 401 or 200

process.env.JWT_SECRET = 'test-secret-key-that-is-at-least-32-characters-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://localhost/test';

import * as fc from 'fast-check';
import request from 'supertest';
import app from '../src/app';

/**
 * Property 3: Invalid email format rejection
 *
 * For any string that is not a valid email format (missing @, missing domain, etc.),
 * submitting it as the email field to the login endpoint SHALL result in a 400 response
 * with a validation error, never a 401 or 200.
 *
 * **Validates: Requirements 2.6**
 */
describe('Property: Invalid email format rejection', () => {
  // Simple email regex to filter out valid emails
  const isValidEmail = (s: string): boolean =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  it(
    'should return 400 for any string that is not a valid email format',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // Strings without @ symbol
            fc.string({ minLength: 1, maxLength: 50 }).filter(s => !s.includes('@')),
            // Strings with @ but no valid domain (no dot after @)
            fc.tuple(
              fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('@') && !s.includes('.')),
              fc.string({ minLength: 1, maxLength: 20 }).filter(s => !s.includes('@') && !s.includes('.'))
            ).map(([local, domain]) => `${local}@${domain}`),
            // Empty string
            fc.constant(''),
            // Just an @ symbol
            fc.constant('@'),
            // Strings with spaces
            fc.string({ minLength: 1, maxLength: 30 }).filter(s => s.includes(' ') && !isValidEmail(s))
          ).filter(s => !isValidEmail(s)),
          async (invalidEmail: string) => {
            const response = await request(app)
              .post('/api/auth/login')
              .send({ email: invalidEmail, password: 'anyPassword123' });

            // Must be 400 (validation error), not 401 or 200
            expect(response.status).toBe(400);
            expect(response.body.error.code).toBe('VALIDATION_ERROR');
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );
});

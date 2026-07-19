// Feature: jwt-auth, Property 1: For any plaintext password (1–72 bytes), bcrypt hashing produces a 60-char string with $2b$10$ prefix

import * as fc from 'fast-check';
import bcrypt from 'bcrypt';

/**
 * Property 1: Bcrypt hashing produces valid hashes
 *
 * For any plaintext password string (1–72 bytes), hashing it with bcrypt at cost
 * factor 10 produces a 60-character string beginning with `$2b$10$`.
 *
 * **Validates: Requirements 1.2**
 */
describe('Property: Bcrypt hashing produces valid hashes', () => {
  it(
    'should produce a 60-char hash with $2b$10$ prefix for any password (1–72 bytes)',
    async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 72 }),
          async (password: string) => {
            const hash = await bcrypt.hash(password, 10);

            // Hash must be exactly 60 characters
            expect(hash).toHaveLength(60);

            // Hash must start with the bcrypt $2b$10$ prefix
            expect(hash.startsWith('$2b$10$')).toBe(true);
          }
        ),
        { numRuns: 20 }
      );
    },
    120000
  );
});

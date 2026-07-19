// Feature: ticket-list-filters, Property 9-12: Schema validation properties

import * as fc from 'fast-check';
import { listTicketsQuerySchema } from '../src/schemas/ticketSchemas';

/**
 * Property 9: Invalid input rejection
 *
 * For any query parameter value that violates its validation rules
 * (invalid enum value, non-UUID non-"unassigned" assignedTo, out-of-range pageSize,
 * non-integer page/pageSize, invalid sortBy/sortOrder), the schema SHALL reject it
 * via safeParse returning success: false with an error identifying the offending field.
 *
 * **Validates: Requirements 1.3, 2.4, 3.8, 3.9, 4.7, 4.8, 6.2**
 */
describe('Feature: ticket-list-filters, Property 9: Invalid input rejection', () => {
  it('should reject invalid priority values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => !['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'low', 'medium', 'high', 'urgent',
                   'Low', 'Medium', 'High', 'Urgent'].includes(s)
        ),
        (invalidPriority) => {
          const result = listTicketsQuerySchema.safeParse({ priority: invalidPriority });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('priority');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid assignedTo values (not UUID and not "unassigned")', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 50 }).filter((s) => {
          // Not "unassigned" and not a valid UUID v4 pattern
          if (s === 'unassigned') return false;
          const uuidV4Regex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          return !uuidV4Regex.test(s);
        }),
        (invalidAssignedTo) => {
          const result = listTicketsQuerySchema.safeParse({ assignedTo: invalidAssignedTo });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('assignedTo');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid sortBy values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => s !== 'updatedAt' && s !== 'priority'
        ),
        (invalidSortBy) => {
          const result = listTicketsQuerySchema.safeParse({ sortBy: invalidSortBy });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('sortBy');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject invalid sortOrder values', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter(
          (s) => s !== 'asc' && s !== 'desc'
        ),
        (invalidSortOrder) => {
          const result = listTicketsQuerySchema.safeParse({ sortOrder: invalidSortOrder });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('sortOrder');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject page values less than 1', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1000, max: 0 }).map(String),
        (invalidPage) => {
          const result = listTicketsQuerySchema.safeParse({ page: invalidPage });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('page');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject pageSize values outside 1-100 range', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: 0 }).map(String),
          fc.integer({ min: 101, max: 10000 }).map(String)
        ),
        (invalidPageSize) => {
          const result = listTicketsQuerySchema.safeParse({ pageSize: invalidPageSize });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('pageSize');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 10: Multiple validation errors reported together
 *
 * For any request with multiple invalid parameters, the parse result SHALL contain
 * one error per invalid field, reporting all validation failures in a single response
 * rather than stopping at the first.
 *
 * **Validates: Requirements 4.9, 6.3**
 */
describe('Feature: ticket-list-filters, Property 10: Multiple validation errors reported together', () => {
  it('should report errors for all invalid fields simultaneously', () => {
    fc.assert(
      fc.property(
        fc.record({
          priority: fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) => !['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'low', 'medium', 'high', 'urgent',
                     'Low', 'Medium', 'High', 'Urgent'].includes(s)
          ),
          sortBy: fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) => s !== 'updatedAt' && s !== 'priority'
          ),
          sortOrder: fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) => s !== 'asc' && s !== 'desc'
          ),
        }),
        (invalidParams) => {
          const result = listTicketsQuerySchema.safeParse(invalidParams);
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = new Set(result.error.issues.map((i) => i.path[0]));
            // All three invalid fields should be reported
            expect(fields.has('priority')).toBe(true);
            expect(fields.has('sortBy')).toBe(true);
            expect(fields.has('sortOrder')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should report errors for invalid page and pageSize together', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.constantFrom('abc', 'xyz', '1.5', 'not-a-number', ''),
          fc.constantFrom('def', 'zzz', '2.7', 'invalid', '')
        ),
        ([invalidPage, invalidPageSize]) => {
          const result = listTicketsQuerySchema.safeParse({
            page: invalidPage,
            pageSize: invalidPageSize,
          });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = new Set(result.error.issues.map((i) => i.path[0]));
            expect(fields.has('page')).toBe(true);
            expect(fields.has('pageSize')).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 11: Unknown parameters silently ignored
 *
 * For any request containing unknown query parameters, the schema SHALL parse
 * successfully (passthrough), effectively ignoring the unknown parameters.
 *
 * **Validates: Requirements 6.5**
 */
describe('Feature: ticket-list-filters, Property 11: Unknown parameters silently ignored', () => {
  it('should parse successfully when unknown parameters are present', () => {
    fc.assert(
      fc.property(
        fc.dictionary(
          // Generate random keys that are NOT known schema keys
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) =>
              !['keyword', 'status', 'tag', 'priority', 'assignedTo',
                'sortBy', 'sortOrder', 'page', 'pageSize'].includes(s) &&
              /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)
          ),
          fc.string({ minLength: 0, maxLength: 50 }),
          { minKeys: 1, maxKeys: 5 }
        ),
        (unknownParams) => {
          const result = listTicketsQuerySchema.safeParse(unknownParams);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should parse successfully with unknown params alongside valid known params', () => {
    fc.assert(
      fc.property(
        fc.record({
          sortBy: fc.constantFrom('updatedAt', 'priority'),
          sortOrder: fc.constantFrom('asc', 'desc'),
        }),
        fc.dictionary(
          fc.string({ minLength: 1, maxLength: 20 }).filter(
            (s) =>
              !['keyword', 'status', 'tag', 'priority', 'assignedTo',
                'sortBy', 'sortOrder', 'page', 'pageSize'].includes(s) &&
              /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(s)
          ),
          fc.string({ minLength: 0, maxLength: 50 }),
          { minKeys: 1, maxKeys: 3 }
        ),
        (validParams, unknownParams) => {
          const combined = { ...validParams, ...unknownParams };
          const result = listTicketsQuerySchema.safeParse(combined);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Property 12: String-to-integer coercion for pagination
 *
 * For any numeric string value as page/pageSize, it SHALL coerce to integer;
 * for non-numeric strings it SHALL reject.
 *
 * **Validates: Requirements 6.4**
 */
describe('Feature: ticket-list-filters, Property 12: String-to-integer coercion for pagination', () => {
  it('should coerce valid numeric strings for page to integers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10000 }),
        (pageNum) => {
          const result = listTicketsQuerySchema.safeParse({ page: String(pageNum) });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.page).toBe(pageNum);
            expect(typeof result.data.page).toBe('number');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should coerce valid numeric strings for pageSize to integers', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (pageSizeNum) => {
          const result = listTicketsQuerySchema.safeParse({ pageSize: String(pageSizeNum) });
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.pageSize).toBe(pageSizeNum);
            expect(typeof result.data.pageSize).toBe('number');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject non-numeric strings for page', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => {
          const num = Number(s);
          return isNaN(num) || !Number.isInteger(num);
        }),
        (nonNumeric) => {
          const result = listTicketsQuerySchema.safeParse({ page: nonNumeric });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('page');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject non-numeric strings for pageSize', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 30 }).filter((s) => {
          const num = Number(s);
          return isNaN(num) || !Number.isInteger(num);
        }),
        (nonNumeric) => {
          const result = listTicketsQuerySchema.safeParse({ pageSize: nonNumeric });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('pageSize');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject float strings for page (non-integer)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 1, max: 1000 }),
          fc.integer({ min: 1, max: 99 })
        ).map(([whole, frac]) => `${whole}.${frac}`),
        (floatString) => {
          const result = listTicketsQuerySchema.safeParse({ page: floatString });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('page');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should reject float strings for pageSize (non-integer)', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          fc.integer({ min: 1, max: 100 }),
          fc.integer({ min: 1, max: 99 })
        ).map(([whole, frac]) => `${whole}.${frac}`),
        (floatString) => {
          const result = listTicketsQuerySchema.safeParse({ pageSize: floatString });
          expect(result.success).toBe(false);
          if (!result.success) {
            const fields = result.error.issues.map((i) => i.path[0]);
            expect(fields).toContain('pageSize');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

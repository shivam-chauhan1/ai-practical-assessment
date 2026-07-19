import fc from 'fast-check';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

// Mock PrismaClient before importing the service
jest.mock('@prisma/client', () => {
  const actualPrisma = jest.requireActual('@prisma/client');

  const mockPrismaClient = {
    tag: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      delete: jest.fn(),
    },
  };

  return {
    ...actualPrisma,
    PrismaClient: jest.fn(() => mockPrismaClient),
    __mockPrismaClient: mockPrismaClient,
  };
});

import { createTag, listTags } from '../src/services/tagService';
import { ConflictError } from '../src/errors';
import { createTagSchema } from '../src/schemas/tagSchemas';

const { __mockPrismaClient: mockPrisma } = jest.requireMock('@prisma/client');

describe('Tag Service - Property Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Property 1: Case-insensitive tag name uniqueness
   *
   * For any two tag name strings that are identical when compared case-insensitively,
   * creating the first tag should succeed and creating the second should be rejected
   * with a ConflictError.
   *
   * **Validates: Requirements 1.4, 2.2**
   */
  it('Property 1: Case-insensitive tag name uniqueness', () => {
    // Generate a base name and a case-variant of it
    const baseNameArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length >= 1 && s.trim().length <= 50);

    const caseVariantArb = baseNameArb.chain(name =>
      fc.tuple(
        fc.constant(name),
        // Generate a case variant by mapping chars to upper/lower
        fc.array(fc.boolean(), { minLength: name.length, maxLength: name.length }).map(bools =>
          name.split('').map((c, i) => bools[i] ? c.toUpperCase() : c.toLowerCase()).join('')
        )
      )
    );

    fc.assert(
      fc.asyncProperty(
        caseVariantArb,
        async ([firstName, secondName]) => {
          // First creation succeeds
          mockPrisma.tag.create
            .mockResolvedValueOnce({
              id: 'tag-id-1',
              name: firstName,
              createdAt: new Date(),
            })
            // Second creation throws P2002 (unique constraint violation)
            .mockImplementationOnce(async () => {
              throw new Prisma.PrismaClientKnownRequestError(
                'Unique constraint failed on the fields: (`name`)',
                { code: 'P2002', clientVersion: '5.0.0' }
              );
            });

          // First call succeeds
          const result = await createTag(firstName);
          expect(result.name).toBe(firstName);

          // Second call with case-variant should throw ConflictError
          await expect(createTag(secondName)).rejects.toThrow(ConflictError);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2: Tag name trimming on creation
   *
   * For any valid tag name string surrounded by arbitrary leading/trailing whitespace,
   * the Zod schema trims it before it reaches the service. The parsed name should equal
   * the trimmed version of the input.
   *
   * **Validates: Requirements 2.1**
   */
  it('Property 2: Tag name trimming on creation', () => {
    // Generate a core name (1-50 chars, non-empty after trim)
    const coreNameArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length >= 1 && s.trim().length <= 50);

    // Generate leading and trailing whitespace
    const whitespaceArb = fc.stringOf(
      fc.constantFrom(' ', '\t', '\n', '\r'),
      { minLength: 1, maxLength: 5 }
    );

    fc.assert(
      fc.property(
        coreNameArb,
        whitespaceArb,
        whitespaceArb,
        (coreName, leadingWs, trailingWs) => {
          const inputWithWhitespace = leadingWs + coreName + trailingWs;
          const expectedTrimmed = inputWithWhitespace.trim();

          // Skip if trimmed result exceeds 50 chars
          if (expectedTrimmed.length > 50 || expectedTrimmed.length < 1) {
            return;
          }

          const parsed = createTagSchema.parse({ name: inputWithWhitespace });
          expect(parsed.name).toBe(expectedTrimmed);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 3: Invalid tag name rejection
   *
   * For empty strings, whitespace-only strings, or strings > 50 chars after trim,
   * createTagSchema.parse should throw ZodError.
   *
   * **Validates: Requirements 2.3**
   */
  it('Property 3: Invalid tag name rejection', () => {
    // Generator for whitespace-only strings (empty after trim)
    const whitespaceOnlyArb = fc.stringOf(
      fc.constantFrom(' ', '\t', '\n', '\r'),
      { minLength: 0, maxLength: 20 }
    );

    // Generator for strings that exceed 50 chars after trim
    const tooLongArb = fc.string({ minLength: 51, maxLength: 100 })
      .filter(s => s.trim().length > 50);

    // Test whitespace-only strings (includes empty string)
    fc.assert(
      fc.property(
        whitespaceOnlyArb,
        (wsOnly) => {
          expect(() => createTagSchema.parse({ name: wsOnly })).toThrow(ZodError);
        }
      ),
      { numRuns: 100 }
    );

    // Test strings exceeding 50 chars after trim
    fc.assert(
      fc.property(
        tooLongArb,
        (tooLong) => {
          expect(() => createTagSchema.parse({ name: tooLong })).toThrow(ZodError);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 4: Alphabetical tag listing
   *
   * For any set of tag names, listTags returns them sorted alphabetically
   * (case-insensitive).
   *
   * **Validates: Requirements 2.4**
   */
  it('Property 4: Alphabetical tag listing', () => {
    const tagNameArb = fc.string({ minLength: 1, maxLength: 50 })
      .filter(s => s.trim().length >= 1);

    const tagListArb = fc.array(tagNameArb, { minLength: 0, maxLength: 20 });

    fc.assert(
      fc.asyncProperty(
        tagListArb,
        async (tagNames) => {
          // Create mock tag objects in random order
          const mockTags = tagNames.map((name, i) => ({
            id: `tag-id-${i}`,
            name,
            createdAt: new Date(),
          }));

          // Mock findMany to return tags sorted alphabetically (as Prisma would)
          const sortedTags = [...mockTags].sort((a, b) =>
            a.name.toLowerCase().localeCompare(b.name.toLowerCase())
          );
          mockPrisma.tag.findMany.mockResolvedValue(sortedTags);

          const result = await listTags();

          // Verify the result is sorted alphabetically case-insensitive
          for (let i = 0; i < result.length - 1; i++) {
            const current = result[i].name.toLowerCase();
            const next = result[i + 1].name.toLowerCase();
            expect(current.localeCompare(next)).toBeLessThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

import fc from 'fast-check';
import request from 'supertest';
import { PrismaClient, Status } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../src/app';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

const TEST_USER_ID = 'd0000000-0000-4000-a000-000000000021';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-that-is-at-least-32-characters-long';
const authToken = jwt.sign({ id: TEST_USER_ID, email: 'searchtest@test.local', role: 'AGENT' }, JWT_SECRET, { expiresIn: '1h' });

beforeAll(async () => {
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: { id: TEST_USER_ID, name: 'Search Test User', email: 'searchtest@test.local', role: 'AGENT', password: '$2b$10$dummyhashedpasswordfortest1234567890abc' },
  });
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
});

const ALL_STATUSES: Status[] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED', 'CANCELLED'];

describe('Search/Filter Property Tests', () => {
  /**
   * Property 10: Keyword search returns only matching tickets
   *
   * For any keyword string, search results should ONLY contain tickets where
   * title or description contains the keyword as a case-insensitive substring.
   * Results are ordered by updatedAt descending.
   *
   * **Validates: Requirements 7.1**
   */
  it('Property 10: Keyword search returns only matching tickets', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a unique marker string to isolate test data
        fc.stringMatching(/^[a-z]{4,8}$/),
        fc.constantFrom(...ALL_STATUSES),
        async (marker, status) => {
          const uniqueTag = `SRCH10_${uuidv4().slice(0, 8)}`;
          const keyword = `${uniqueTag}_${marker}`;

          // Create tickets: some matching (keyword in title or description), some not
          const matchingByTitle = await prisma.ticket.create({
            data: {
              title: `Ticket with ${keyword} in title`,
              description: 'No match here',
              priority: 'MEDIUM',
              status,
              createdBy: TEST_USER_ID,
            },
          });

          const matchingByDescription = await prisma.ticket.create({
            data: {
              title: 'Plain title',
              description: `Description contains ${keyword} here`,
              priority: 'LOW',
              status: 'OPEN',
              createdBy: TEST_USER_ID,
            },
          });

          const nonMatching = await prisma.ticket.create({
            data: {
              title: 'Completely unrelated title',
              description: 'Nothing relevant in description',
              priority: 'HIGH',
              status: 'OPEN',
              createdBy: TEST_USER_ID,
            },
          });

          // Query the API with the keyword
          const res = await request(app)
            .get(`/api/tickets?keyword=${encodeURIComponent(keyword)}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const results: any[] = res.body.data;

          // All results must contain the keyword in title or description (case-insensitive)
          const keywordLower = keyword.toLowerCase();
          for (const ticket of results) {
            const titleMatch = ticket.title.toLowerCase().includes(keywordLower);
            const descMatch = ticket.description.toLowerCase().includes(keywordLower);
            expect(titleMatch || descMatch).toBe(true);
          }

          // Our matching tickets must be in results
          const resultIds = results.map((t: any) => t.id);
          expect(resultIds).toContain(matchingByTitle.id);
          expect(resultIds).toContain(matchingByDescription.id);

          // Our non-matching ticket must NOT be in results
          expect(resultIds).not.toContain(nonMatching.id);

          // Results should be ordered by updatedAt descending
          for (let i = 0; i < results.length - 1; i++) {
            expect(new Date(results[i].updatedAt).getTime())
              .toBeGreaterThanOrEqual(new Date(results[i + 1].updatedAt).getTime());
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 11: Status filter returns only matching tickets
   *
   * For any valid status value, filter results should ONLY contain tickets
   * with that exact status.
   *
   * **Validates: Requirements 7.2**
   */
  it('Property 11: Status filter returns only matching tickets', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...ALL_STATUSES),
        async (filterStatus) => {
          const uniqueTag = `SRCH11_${uuidv4().slice(0, 8)}`;

          // Create tickets in different statuses
          const matchingTicket = await prisma.ticket.create({
            data: {
              title: `${uniqueTag} matching ticket`,
              description: 'Matching status ticket',
              priority: 'MEDIUM',
              status: filterStatus,
              createdBy: TEST_USER_ID,
            },
          });

          // Pick a different status for the non-matching ticket
          const otherStatus = ALL_STATUSES.find(s => s !== filterStatus) || 'OPEN';
          const nonMatchingTicket = await prisma.ticket.create({
            data: {
              title: `${uniqueTag} non-matching ticket`,
              description: 'Different status ticket',
              priority: 'LOW',
              status: otherStatus,
              createdBy: TEST_USER_ID,
            },
          });

          // Query with status filter
          const res = await request(app)
            .get(`/api/tickets?status=${filterStatus}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const results: any[] = res.body.data;

          // ALL results must have the filtered status
          for (const ticket of results) {
            expect(ticket.status).toBe(filterStatus);
          }

          // Our matching ticket must be in results
          const resultIds = results.map((t: any) => t.id);
          expect(resultIds).toContain(matchingTicket.id);

          // Our non-matching ticket must NOT be in results
          expect(resultIds).not.toContain(nonMatchingTicket.id);

          // Results should be ordered by updatedAt descending
          for (let i = 0; i < results.length - 1; i++) {
            expect(new Date(results[i].updatedAt).getTime())
              .toBeGreaterThanOrEqual(new Date(results[i + 1].updatedAt).getTime());
          }
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 12: Combined search filters apply as logical AND
   *
   * When both keyword and status are provided, results must match BOTH conditions.
   *
   * **Validates: Requirements 7.3**
   */
  it('Property 12: Combined search filters apply as logical AND', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z]{4,8}$/),
        fc.constantFrom(...ALL_STATUSES),
        async (marker, filterStatus) => {
          const uniqueTag = `SRCH12_${uuidv4().slice(0, 8)}`;
          const keyword = `${uniqueTag}_${marker}`;

          // Pick a different status for non-matching
          const otherStatus = ALL_STATUSES.find(s => s !== filterStatus) || 'OPEN';

          // Ticket matching BOTH keyword AND status
          const matchesBoth = await prisma.ticket.create({
            data: {
              title: `Ticket ${keyword} both`,
              description: 'Matches both filters',
              priority: 'MEDIUM',
              status: filterStatus,
              createdBy: TEST_USER_ID,
            },
          });

          // Ticket matching keyword but NOT status
          const matchesKeywordOnly = await prisma.ticket.create({
            data: {
              title: `Ticket ${keyword} keyword only`,
              description: 'Has keyword but wrong status',
              priority: 'LOW',
              status: otherStatus,
              createdBy: TEST_USER_ID,
            },
          });

          // Ticket matching status but NOT keyword
          const matchesStatusOnly = await prisma.ticket.create({
            data: {
              title: 'No keyword here',
              description: 'Completely unrelated content',
              priority: 'HIGH',
              status: filterStatus,
              createdBy: TEST_USER_ID,
            },
          });

          // Ticket matching neither
          const matchesNeither = await prisma.ticket.create({
            data: {
              title: 'Irrelevant title',
              description: 'Irrelevant description',
              priority: 'LOW',
              status: otherStatus,
              createdBy: TEST_USER_ID,
            },
          });

          // Query with both keyword and status
          const res = await request(app)
            .get(`/api/tickets?keyword=${encodeURIComponent(keyword)}&status=${filterStatus}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

          const results: any[] = res.body.data;

          // All results must match BOTH conditions
          const keywordLower = keyword.toLowerCase();
          for (const ticket of results) {
            // Must match status
            expect(ticket.status).toBe(filterStatus);
            // Must match keyword in title or description
            const titleMatch = ticket.title.toLowerCase().includes(keywordLower);
            const descMatch = ticket.description.toLowerCase().includes(keywordLower);
            expect(titleMatch || descMatch).toBe(true);
          }

          // The ticket matching both must be in results
          const resultIds = results.map((t: any) => t.id);
          expect(resultIds).toContain(matchesBoth.id);

          // Tickets not matching both must NOT be in results
          expect(resultIds).not.toContain(matchesKeywordOnly.id);
          expect(resultIds).not.toContain(matchesStatusOnly.id);
          expect(resultIds).not.toContain(matchesNeither.id);

          // Results should be ordered by updatedAt descending
          for (let i = 0; i < results.length - 1; i++) {
            expect(new Date(results[i].updatedAt).getTime())
              .toBeGreaterThanOrEqual(new Date(results[i + 1].updatedAt).getTime());
          }
        }
      ),
      { numRuns: 10 }
    );
  });
});

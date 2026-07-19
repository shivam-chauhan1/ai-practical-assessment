import request from 'supertest';
import { PrismaClient, Priority } from '@prisma/client';
import jwt from 'jsonwebtoken';
import * as fc from 'fast-check';
import app from '../src/app';

const prisma = new PrismaClient();

const TEST_USER_ID = 'f0000000-0000-4000-a000-000000000001';
const TEST_USER_2_ID = 'f0000000-0000-4000-a000-000000000002';
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-that-is-at-least-32-characters-long';
const authToken = jwt.sign(
  { id: TEST_USER_ID, email: 'filtertest@test.local', role: 'ADMIN' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

beforeAll(async () => {
  // Create test users
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      name: 'Filter Test User',
      email: 'filtertest@test.local',
      role: 'AGENT',
      password: '$2b$10$dummyhashedpasswordfortest1234567890abc',
    },
  });
  await prisma.user.upsert({
    where: { id: TEST_USER_2_ID },
    update: {},
    create: {
      id: TEST_USER_2_ID,
      name: 'Filter Test User 2',
      email: 'filtertest2@test.local',
      role: 'AGENT',
      password: '$2b$10$dummyhashedpasswordfortest1234567890abc',
    },
  });
});

afterAll(async () => {
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
  await prisma.user.deleteMany({ where: { id: { in: [TEST_USER_ID, TEST_USER_2_ID] } } });
  await prisma.$disconnect();
});

afterEach(async () => {
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
});

describe('GET /api/tickets — Priority Filter', () => {
  it('returns only HIGH priority tickets when priority=HIGH', async () => {
    await prisma.ticket.createMany({
      data: [
        { title: 'High ticket', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID },
        { title: 'Low ticket', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
        { title: 'Medium ticket', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID },
      ],
    });

    const res = await request(app)
      .get('/api/tickets?priority=HIGH')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((t: any) => t.priority === 'HIGH')).toBe(true);
  });

  it('returns tickets of all priorities when priority is omitted', async () => {
    await prisma.ticket.createMany({
      data: [
        { title: 'High one', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID },
        { title: 'Low one', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
      ],
    });

    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const priorities = res.body.data.map((t: any) => t.priority);
    expect(priorities).toContain('HIGH');
    expect(priorities).toContain('LOW');
  });

  it('returns empty data when no tickets match the priority', async () => {
    await prisma.ticket.create({
      data: { title: 'Only low', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .get('/api/tickets?priority=URGENT')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const ours = res.body.data.filter((t: any) => t.createdBy === TEST_USER_ID);
    expect(ours).toHaveLength(0);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(0);
  });
});

describe('GET /api/tickets — AssignedTo Filter', () => {
  it('returns only unassigned tickets when assignedTo=unassigned', async () => {
    await prisma.ticket.createMany({
      data: [
        { title: 'Unassigned ticket', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID, assignedTo: null },
        { title: 'Assigned ticket', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID, assignedTo: TEST_USER_2_ID },
      ],
    });

    const res = await request(app)
      .get('/api/tickets?assignedTo=unassigned')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data.every((t: any) => t.assignedTo === null)).toBe(true);
  });

  it('returns only tickets assigned to a specific UUID', async () => {
    await prisma.ticket.createMany({
      data: [
        { title: 'Assigned to user2', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID, assignedTo: TEST_USER_2_ID },
        { title: 'Unassigned', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID, assignedTo: null },
      ],
    });

    const res = await request(app)
      .get(`/api/tickets?assignedTo=${TEST_USER_2_ID}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((t: any) => t.assignedTo === TEST_USER_2_ID)).toBe(true);
  });

  it('returns empty data when assignedTo UUID does not match any tickets', async () => {
    await prisma.ticket.create({
      data: { title: 'No match', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID, assignedTo: null },
    });

    const nonExistentUuid = 'f0000000-0000-4000-a000-000000000099';
    const res = await request(app)
      .get(`/api/tickets?assignedTo=${nonExistentUuid}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(0);
  });
});

describe('GET /api/tickets — Sort Parameters', () => {
  it('sorts by updatedAt ascending', async () => {
    await prisma.ticket.create({
      data: { title: 'First created', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });
    await new Promise(r => setTimeout(r, 50));
    await prisma.ticket.create({
      data: { title: 'Second created', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .get('/api/tickets?sortBy=updatedAt&sortOrder=asc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const timestamps = res.body.data.map((t: any) => new Date(t.updatedAt).getTime());
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeLessThanOrEqual(timestamps[i + 1]);
    }
  });

  it('sorts by updatedAt descending (default)', async () => {
    await prisma.ticket.create({
      data: { title: 'First', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });
    await new Promise(r => setTimeout(r, 50));
    await prisma.ticket.create({
      data: { title: 'Second', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const timestamps = res.body.data.map((t: any) => new Date(t.updatedAt).getTime());
    for (let i = 0; i < timestamps.length - 1; i++) {
      expect(timestamps[i]).toBeGreaterThanOrEqual(timestamps[i + 1]);
    }
  });

  it('sorts by priority descending (URGENT first)', async () => {
    await prisma.ticket.createMany({
      data: [
        { title: 'Low prio', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
        { title: 'Urgent prio', description: 'Desc', priority: 'URGENT', createdBy: TEST_USER_ID },
        { title: 'Medium prio', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID },
      ],
    });

    const res = await request(app)
      .get('/api/tickets?sortBy=priority&sortOrder=desc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const priorityOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
    const priorities = res.body.data.map((t: any) => priorityOrder[t.priority]);
    for (let i = 0; i < priorities.length - 1; i++) {
      expect(priorities[i]).toBeGreaterThanOrEqual(priorities[i + 1]);
    }
  });

  it('sorts by priority ascending (LOW first)', async () => {
    await prisma.ticket.createMany({
      data: [
        { title: 'Urgent', description: 'Desc', priority: 'URGENT', createdBy: TEST_USER_ID },
        { title: 'Low', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
        { title: 'High', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID },
      ],
    });

    const res = await request(app)
      .get('/api/tickets?sortBy=priority&sortOrder=asc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const priorityOrder: Record<string, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, URGENT: 3 };
    const priorities = res.body.data.map((t: any) => priorityOrder[t.priority]);
    for (let i = 0; i < priorities.length - 1; i++) {
      expect(priorities[i]).toBeLessThanOrEqual(priorities[i + 1]);
    }
  });
});

describe('GET /api/tickets — Pagination', () => {
  it('returns correct number of tickets for pageSize', async () => {
    // Create 5 tickets
    await prisma.ticket.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        title: `Pagination ticket ${i}`,
        description: 'Desc',
        priority: 'LOW' as Priority,
        createdBy: TEST_USER_ID,
      })),
    });

    const res = await request(app)
      .get('/api/tickets?page=1&pageSize=2')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data.length).toBe(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(2);
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(5);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(3);
  });

  it('returns second page of results', async () => {
    await prisma.ticket.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        title: `PaginationPageTest ticket ${i}`,
        description: 'PaginationPageTest',
        priority: 'MEDIUM' as Priority,
        createdBy: TEST_USER_ID,
      })),
    });

    const page1 = await request(app)
      .get('/api/tickets?page=1&pageSize=2&keyword=PaginationPageTest&sortBy=updatedAt&sortOrder=desc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const page2 = await request(app)
      .get('/api/tickets?page=2&pageSize=2&keyword=PaginationPageTest&sortBy=updatedAt&sortOrder=desc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(page1.body.data.length).toBe(2);
    expect(page2.body.data.length).toBe(2);

    // Pages should have different tickets
    const page1Ids = page1.body.data.map((t: any) => t.id);
    const page2Ids = page2.body.data.map((t: any) => t.id);
    expect(page1Ids.some((id: string) => page2Ids.includes(id))).toBe(false);
  });

  it('returns empty data with correct metadata when page exceeds total', async () => {
    await prisma.ticket.create({
      data: { title: 'Only ticket', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .get('/api/tickets?page=999&pageSize=10')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data).toHaveLength(0);
    expect(res.body.pagination.page).toBe(999);
    expect(res.body.pagination.pageSize).toBe(10);
    expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(0);
  });

  it('defaults to page=1 and pageSize=20 when not provided', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.pageSize).toBe(20);
  });
});

describe('GET /api/tickets — Combined Filters (AND logic)', () => {
  it('applies priority AND assignedTo with AND logic', async () => {
    await prisma.ticket.createMany({
      data: [
        { title: 'High unassigned', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID, assignedTo: null },
        { title: 'High assigned', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID, assignedTo: TEST_USER_2_ID },
        { title: 'Low unassigned', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID, assignedTo: null },
      ],
    });

    const res = await request(app)
      .get('/api/tickets?priority=HIGH&assignedTo=unassigned')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((t: any) => t.priority === 'HIGH' && t.assignedTo === null)).toBe(true);
  });

  it('applies priority AND keyword with AND logic', async () => {
    await prisma.ticket.createMany({
      data: [
        { title: 'UniqueFilterCombo HIGH', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID },
        { title: 'UniqueFilterCombo LOW', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
        { title: 'Other HIGH', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID },
      ],
    });

    const res = await request(app)
      .get('/api/tickets?priority=HIGH&keyword=UniqueFilterCombo')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(
      res.body.data.every(
        (t: any) => t.priority === 'HIGH' && t.title.includes('UniqueFilterCombo')
      )
    ).toBe(true);
  });
});

describe('GET /api/tickets — Response Envelope Structure', () => {
  it('response has exactly data and pagination top-level fields', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(Object.keys(res.body).sort()).toEqual(['data', 'pagination']);
  });

  it('pagination contains page, pageSize, total, and totalPages', async () => {
    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.pagination).toEqual(
      expect.objectContaining({
        page: expect.any(Number),
        pageSize: expect.any(Number),
        total: expect.any(Number),
        totalPages: expect.any(Number),
      })
    );
    expect(Object.keys(res.body.pagination).sort()).toEqual(['page', 'pageSize', 'total', 'totalPages']);
  });

  it('each ticket in data includes validTransitions, creator, assignee, and tags', async () => {
    await prisma.ticket.create({
      data: { title: 'Envelope test', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID },
    });

    const res = await request(app)
      .get('/api/tickets')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    const testTicket = res.body.data.find((t: any) => t.title === 'Envelope test');
    expect(testTicket).toBeDefined();
    expect(testTicket.validTransitions).toBeDefined();
    expect(Array.isArray(testTicket.validTransitions)).toBe(true);
    expect(testTicket.creator).toBeDefined();
    expect(testTicket.creator.id).toBe(TEST_USER_ID);
    expect(testTicket.creator.name).toBeDefined();
    expect(testTicket.creator.email).toBeDefined();
    expect(testTicket).toHaveProperty('assignee');
    expect(testTicket.tags).toBeDefined();
    expect(Array.isArray(testTicket.tags)).toBe(true);
  });

  it('returns empty data array with pagination when no tickets match', async () => {
    const res = await request(app)
      .get('/api/tickets?priority=URGENT&keyword=NonExistentKeyword12345')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
    expect(res.body.pagination.totalPages).toBe(0);
  });
});

describe('GET /api/tickets — Validation Errors', () => {
  it('returns HTTP 400 with VALIDATION_ERROR for invalid priority', async () => {
    const res = await request(app)
      .get('/api/tickets?priority=INVALID')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeDefined();
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'priority', message: expect.any(String) })])
    );
  });

  it('returns HTTP 400 for invalid assignedTo (not UUID, not "unassigned")', async () => {
    const res = await request(app)
      .get('/api/tickets?assignedTo=not-valid')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'assignedTo' })])
    );
  });

  it('returns multiple validation errors in a single response', async () => {
    const res = await request(app)
      .get('/api/tickets?priority=BOGUS&sortBy=wrong&pageSize=0')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
    const fields = res.body.error.details.map((d: any) => d.field);
    expect(fields).toContain('priority');
    expect(fields).toContain('sortBy');
    expect(fields).toContain('pageSize');
  });

  it('returns HTTP 400 for non-integer page value', async () => {
    const res = await request(app)
      .get('/api/tickets?page=abc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'page' })])
    );
  });

  it('returns HTTP 400 for pageSize out of range (> 100)', async () => {
    const res = await request(app)
      .get('/api/tickets?pageSize=101')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ field: 'pageSize' })])
    );
  });
});

describe('GET /api/tickets — Unknown Params Ignored', () => {
  it('silently ignores unknown query parameters', async () => {
    const res = await request(app)
      .get('/api/tickets?unknownParam=foo&anotherRandom=bar')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });
});

describe('GET /api/tickets — Property 8: Response envelope structure invariant', () => {
  /**
   * **Validates: Requirements 5.1, 5.2, 5.3, 5.4**
   *
   * For any valid request to the ticket list endpoint, the response SHALL be a JSON
   * object with exactly two top-level fields: `data` (an array) and `pagination`
   * (an object containing page, pageSize, total, totalPages).
   */
  it('envelope structure holds for random valid filter combinations', async () => {
    // Seed some tickets for the property test
    await prisma.ticket.createMany({
      data: [
        { title: 'PropTest Low', description: 'Desc', priority: 'LOW', createdBy: TEST_USER_ID, assignedTo: null },
        { title: 'PropTest High', description: 'Desc', priority: 'HIGH', createdBy: TEST_USER_ID, assignedTo: TEST_USER_2_ID },
        { title: 'PropTest Medium', description: 'Desc', priority: 'MEDIUM', createdBy: TEST_USER_ID, assignedTo: null },
        { title: 'PropTest Urgent', description: 'Desc', priority: 'URGENT', createdBy: TEST_USER_ID, assignedTo: TEST_USER_2_ID },
      ],
    });

    const priorityArb = fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    const assignedToArb = fc.constantFrom('unassigned', TEST_USER_2_ID);
    const sortByArb = fc.constantFrom('updatedAt', 'priority');
    const sortOrderArb = fc.constantFrom('asc', 'desc');
    const pageArb = fc.integer({ min: 1, max: 10 });
    const pageSizeArb = fc.integer({ min: 1, max: 100 });

    await fc.assert(
      fc.asyncProperty(
        fc.record({
          priority: fc.option(priorityArb, { nil: undefined }),
          assignedTo: fc.option(assignedToArb, { nil: undefined }),
          sortBy: fc.option(sortByArb, { nil: undefined }),
          sortOrder: fc.option(sortOrderArb, { nil: undefined }),
          page: fc.option(pageArb, { nil: undefined }),
          pageSize: fc.option(pageSizeArb, { nil: undefined }),
        }),
        async (params) => {
          const queryParts: string[] = [];
          if (params.priority !== undefined) queryParts.push(`priority=${params.priority}`);
          if (params.assignedTo !== undefined) queryParts.push(`assignedTo=${params.assignedTo}`);
          if (params.sortBy !== undefined) queryParts.push(`sortBy=${params.sortBy}`);
          if (params.sortOrder !== undefined) queryParts.push(`sortOrder=${params.sortOrder}`);
          if (params.page !== undefined) queryParts.push(`page=${params.page}`);
          if (params.pageSize !== undefined) queryParts.push(`pageSize=${params.pageSize}`);

          const query = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

          const res = await request(app)
            .get(`/api/tickets${query}`)
            .set('Authorization', `Bearer ${authToken}`);

          // Response should be 200
          expect(res.status).toBe(200);

          // Envelope structure: exactly data and pagination top-level
          expect(Object.keys(res.body).sort()).toEqual(['data', 'pagination']);

          // data is an array
          expect(Array.isArray(res.body.data)).toBe(true);

          // pagination has exactly the required fields
          expect(Object.keys(res.body.pagination).sort()).toEqual(['page', 'pageSize', 'total', 'totalPages']);
          expect(typeof res.body.pagination.page).toBe('number');
          expect(typeof res.body.pagination.pageSize).toBe('number');
          expect(typeof res.body.pagination.total).toBe('number');
          expect(typeof res.body.pagination.totalPages).toBe('number');
          expect(res.body.pagination.page).toBeGreaterThanOrEqual(1);
          expect(res.body.pagination.pageSize).toBeGreaterThanOrEqual(1);
          expect(res.body.pagination.total).toBeGreaterThanOrEqual(0);
          expect(res.body.pagination.totalPages).toBeGreaterThanOrEqual(0);

          // Each ticket has required fields
          for (const ticket of res.body.data) {
            expect(ticket).toHaveProperty('validTransitions');
            expect(Array.isArray(ticket.validTransitions)).toBe(true);
            expect(ticket).toHaveProperty('creator');
            expect(ticket.creator).toHaveProperty('id');
            expect(ticket.creator).toHaveProperty('name');
            expect(ticket.creator).toHaveProperty('email');
            expect(ticket).toHaveProperty('assignee');
            expect(ticket).toHaveProperty('tags');
            expect(Array.isArray(ticket.tags)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

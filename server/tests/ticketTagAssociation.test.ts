import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import app from '../src/app';

const prisma = new PrismaClient();

const TEST_USER_ID = 'd0000000-0000-4000-a000-000000000001';
const TAG_PREFIX = 'ttagtest';

let testTag1Id: string;
let testTag2Id: string;
let testTag3Id: string;

beforeAll(async () => {
  // Create test user
  await prisma.user.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: { id: TEST_USER_ID, name: 'TagAssoc Test User', email: 'tagassoc@test.local', role: 'AGENT' },
  });

  // Create test tags
  const tag1 = await prisma.tag.create({ data: { name: `${TAG_PREFIX}_alpha` } });
  const tag2 = await prisma.tag.create({ data: { name: `${TAG_PREFIX}_beta` } });
  const tag3 = await prisma.tag.create({ data: { name: `${TAG_PREFIX}_gamma` } });
  testTag1Id = tag1.id;
  testTag2Id = tag2.id;
  testTag3Id = tag3.id;
});

afterAll(async () => {
  // Clean up tickets created by test user (join table entries cascade)
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
  // Clean up test tags
  await prisma.tag.deleteMany({ where: { name: { startsWith: TAG_PREFIX } } });
  // Clean up test user
  await prisma.user.deleteMany({ where: { id: TEST_USER_ID } });
  await prisma.$disconnect();
});

afterEach(async () => {
  // Clean up tickets between tests
  await prisma.ticket.deleteMany({ where: { createdBy: TEST_USER_ID } });
});

describe('POST /api/tickets with tags', () => {
  it('creates a ticket with tags and returns 201 with tags included', async () => {
    const res = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Ticket with tags',
        description: 'Testing tag association on create',
        priority: 'HIGH',
        createdBy: TEST_USER_ID,
        tags: [testTag1Id, testTag2Id],
      })
      .expect(201);

    expect(res.body.tags).toBeDefined();
    expect(res.body.tags).toHaveLength(2);
    const tagIds = res.body.tags.map((t: any) => t.id);
    expect(tagIds).toContain(testTag1Id);
    expect(tagIds).toContain(testTag2Id);
    // Each tag object has id, name, createdAt
    res.body.tags.forEach((tag: any) => {
      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('name');
      expect(tag).toHaveProperty('createdAt');
    });
  });

  it('returns 400 with VALIDATION_ERROR for invalid tag IDs', async () => {
    const fakeId = '00000000-0000-4000-a000-000000000099';
    const res = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Ticket with bad tags',
        description: 'Should fail validation',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
        tags: [testTag1Id, fakeId],
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'tags' }),
      ])
    );
  });

  it('returns 400 when tags array exceeds 10 items', async () => {
    // Generate 11 valid-looking UUIDs (only format matters for max-length validation)
    const elevenIds = Array.from({ length: 11 }, (_, i) =>
      `e0000000-0000-4000-a000-00000000${String(i).padStart(4, '0')}`
    );

    const res = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Too many tags ticket',
        description: 'Should fail with max tags',
        priority: 'MEDIUM',
        createdBy: TEST_USER_ID,
        tags: elevenIds,
      })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('PATCH /api/tickets/:id with tags (replace semantics)', () => {
  it('replaces existing tags with new set', async () => {
    // Create ticket with tag1 and tag2
    const createRes = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Replace tags test',
        description: 'Will have tags replaced',
        priority: 'MEDIUM',
        createdBy: TEST_USER_ID,
        tags: [testTag1Id, testTag2Id],
      })
      .expect(201);

    const ticketId = createRes.body.id;

    // Update with only tag3 — should replace previous tags
    const updateRes = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .send({ tags: [testTag3Id] })
      .expect(200);

    expect(updateRes.body.tags).toHaveLength(1);
    expect(updateRes.body.tags[0].id).toBe(testTag3Id);
  });

  it('removes all tags when empty array is provided', async () => {
    // Create ticket with tags
    const createRes = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Remove all tags test',
        description: 'Tags will be cleared',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
        tags: [testTag1Id],
      })
      .expect(201);

    const ticketId = createRes.body.id;

    // Update with empty tags array
    const updateRes = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .send({ tags: [] })
      .expect(200);

    expect(updateRes.body.tags).toHaveLength(0);
  });

  it('preserves existing tags when tags field is omitted', async () => {
    // Create ticket with tags
    const createRes = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Preserve tags test',
        description: 'Tags should stay',
        priority: 'HIGH',
        createdBy: TEST_USER_ID,
        tags: [testTag1Id, testTag2Id],
      })
      .expect(201);

    const ticketId = createRes.body.id;

    // Update without tags field — only change title
    const updateRes = await request(app)
      .patch(`/api/tickets/${ticketId}`)
      .send({ title: 'Updated title only' })
      .expect(200);

    expect(updateRes.body.title).toBe('Updated title only');
    expect(updateRes.body.tags).toHaveLength(2);
    const tagIds = updateRes.body.tags.map((t: any) => t.id);
    expect(tagIds).toContain(testTag1Id);
    expect(tagIds).toContain(testTag2Id);
  });
});

describe('GET /api/tickets/:id includes tags', () => {
  it('returns ticket with tags array containing tag objects', async () => {
    const createRes = await request(app)
      .post('/api/tickets')
      .send({
        title: 'Get single with tags',
        description: 'Should include tags on GET',
        priority: 'MEDIUM',
        createdBy: TEST_USER_ID,
        tags: [testTag1Id, testTag3Id],
      })
      .expect(201);

    const ticketId = createRes.body.id;

    const getRes = await request(app)
      .get(`/api/tickets/${ticketId}`)
      .expect(200);

    expect(getRes.body.tags).toHaveLength(2);
    const tagIds = getRes.body.tags.map((t: any) => t.id);
    expect(tagIds).toContain(testTag1Id);
    expect(tagIds).toContain(testTag3Id);
    getRes.body.tags.forEach((tag: any) => {
      expect(tag).toHaveProperty('id');
      expect(tag).toHaveProperty('name');
      expect(tag).toHaveProperty('createdAt');
    });
  });
});

describe('GET /api/tickets includes tags in list', () => {
  it('each ticket in the list includes a tags array', async () => {
    // Create a ticket with tags
    await request(app)
      .post('/api/tickets')
      .send({
        title: 'Listed ticket with tags',
        description: 'Should appear in list with tags',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
        tags: [testTag2Id],
      })
      .expect(201);

    const res = await request(app)
      .get('/api/tickets')
      .expect(200);

    // Find our test ticket
    const testTicket = res.body.find((t: any) => t.title === 'Listed ticket with tags');
    expect(testTicket).toBeDefined();
    expect(testTicket.tags).toBeDefined();
    expect(testTicket.tags).toHaveLength(1);
    expect(testTicket.tags[0].id).toBe(testTag2Id);
    expect(testTicket.tags[0]).toHaveProperty('name');
    expect(testTicket.tags[0]).toHaveProperty('createdAt');
  });

  it('filters tickets by tag using OR logic', async () => {
    // Create ticket with tag1 only
    await request(app)
      .post('/api/tickets')
      .send({
        title: 'Tag filter OR test A',
        description: 'Has tag1',
        priority: 'LOW',
        createdBy: TEST_USER_ID,
        tags: [testTag1Id],
      })
      .expect(201);

    // Create ticket with tag2 only
    await request(app)
      .post('/api/tickets')
      .send({
        title: 'Tag filter OR test B',
        description: 'Has tag2',
        priority: 'MEDIUM',
        createdBy: TEST_USER_ID,
        tags: [testTag2Id],
      })
      .expect(201);

    // Create ticket with tag3 only (should NOT appear)
    await request(app)
      .post('/api/tickets')
      .send({
        title: 'Tag filter OR test C',
        description: 'Has tag3 only',
        priority: 'HIGH',
        createdBy: TEST_USER_ID,
        tags: [testTag3Id],
      })
      .expect(201);

    // Filter by tag1,tag2 — should return tickets A and B (OR logic)
    const res = await request(app)
      .get(`/api/tickets?tag=${testTag1Id},${testTag2Id}`)
      .expect(200);

    const titles = res.body.map((t: any) => t.title);
    expect(titles).toContain('Tag filter OR test A');
    expect(titles).toContain('Tag filter OR test B');
    expect(titles).not.toContain('Tag filter OR test C');
  });
});

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import app from '../src/app';

const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-that-is-at-least-32-characters-long';
const authToken = jwt.sign({ id: 'test-tag-user-001', email: 'tagroutes@test.local', role: 'ADMIN' }, JWT_SECRET, { expiresIn: '1h' });

beforeAll(async () => {
  await prisma.tag.deleteMany({});
});

afterEach(async () => {
  await prisma.tag.deleteMany({});
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('POST /api/tags', () => {
  it('creates a tag with valid name and returns 201 with id, name, createdAt', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Bug' })
      .expect(201);

    expect(res.body.id).toBeDefined();
    expect(res.body.name).toBe('Bug');
    expect(res.body.createdAt).toBeDefined();
  });

  it('returns 409 when creating a tag with a duplicate name (case-insensitive)', async () => {
    await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'Feature' })
      .expect(201);

    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: 'feature' })
      .expect(409);

    expect(res.body.error.code).toBe('CONFLICT');
    expect(res.body.error.message).toContain('Tag with this name already exists');
  });

  it('returns 400 with VALIDATION_ERROR when name is empty', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: '' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name exceeds 50 characters', async () => {
    const longName = 'a'.repeat(51);
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: longName })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name is only whitespace', async () => {
    const res = await request(app)
      .post('/api/tags')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ name: '   ' })
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/tags', () => {
  it('returns 200 with tags sorted alphabetically', async () => {
    // Create tags in non-alphabetical order
    await prisma.tag.createMany({
      data: [
        { name: 'Zebra' },
        { name: 'Apple' },
        { name: 'Mango' },
      ],
    });

    const res = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body).toHaveLength(3);
    expect(res.body[0].name).toBe('Apple');
    expect(res.body[1].name).toBe('Mango');
    expect(res.body[2].name).toBe('Zebra');
  });
});

describe('DELETE /api/tags/:id', () => {
  it('deletes an existing tag and returns 204', async () => {
    const tag = await prisma.tag.create({ data: { name: 'ToDelete' } });

    await request(app)
      .delete(`/api/tags/${tag.id}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(204);

    // Verify it's actually gone
    const found = await prisma.tag.findUnique({ where: { id: tag.id } });
    expect(found).toBeNull();
  });

  it('returns 404 when deleting a non-existent UUID', async () => {
    const nonExistentId = '00000000-0000-4000-a000-000000000099';

    const res = await request(app)
      .delete(`/api/tags/${nonExistentId}`)
      .set('Authorization', `Bearer ${authToken}`)
      .expect(404);

    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 when deleting with an invalid UUID format', async () => {
    const res = await request(app)
      .delete('/api/tags/not-a-valid-uuid')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

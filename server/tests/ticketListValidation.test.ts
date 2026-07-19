import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-that-is-at-least-32-characters-long';
const authToken = jwt.sign(
  { id: 'c0000000-0000-4000-a000-000000000099', email: 'valtest@test.local', role: 'AGENT' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('GET /api/tickets — validation middleware wiring', () => {
  it('returns HTTP 400 with VALIDATION_ERROR when priority is invalid', async () => {
    const res = await request(app)
      .get('/api/tickets?priority=INVALID_PRIORITY')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toBeDefined();
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'priority' }),
      ])
    );
  });

  it('returns HTTP 400 with VALIDATION_ERROR when sortBy is invalid', async () => {
    const res = await request(app)
      .get('/api/tickets?sortBy=invalidField')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'sortBy' }),
      ])
    );
  });

  it('returns HTTP 400 with aggregated details for multiple invalid params', async () => {
    const res = await request(app)
      .get('/api/tickets?priority=BOGUS&sortBy=wrong&pageSize=999')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'priority' }),
        expect.objectContaining({ field: 'sortBy' }),
        expect.objectContaining({ field: 'pageSize' }),
      ])
    );
    // All three errors reported in a single response
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(3);
  });

  it('returns HTTP 400 when page is a non-integer string', async () => {
    const res = await request(app)
      .get('/api/tickets?page=abc')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'page' }),
      ])
    );
  });

  it('returns HTTP 400 when assignedTo is neither UUID nor "unassigned"', async () => {
    const res = await request(app)
      .get('/api/tickets?assignedTo=not-a-uuid')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(400);

    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: 'assignedTo' }),
      ])
    );
  });

  it('accepts valid query parameters without validation error', async () => {
    const res = await request(app)
      .get('/api/tickets?priority=HIGH&sortBy=updatedAt&sortOrder=asc&page=1&pageSize=10')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    // Should return paginated response, not a validation error
    expect(res.body.data).toBeDefined();
    expect(res.body.pagination).toBeDefined();
    expect(res.body.error).toBeUndefined();
  });

  it('silently ignores unknown query parameters', async () => {
    const res = await request(app)
      .get('/api/tickets?unknownParam=foo&anotherUnknown=bar')
      .set('Authorization', `Bearer ${authToken}`)
      .expect(200);

    expect(res.body.data).toBeDefined();
    expect(res.body.pagination).toBeDefined();
  });
});

import request from 'supertest';
import app from '../../app';
import { generateOpenApiDocument } from '../generator';

describe('OpenAPI Integration: /api-docs endpoint', () => {
  it('GET /api-docs returns HTTP 200 with HTML content-type (no auth required)', async () => {
    const res = await request(app)
      .get('/api-docs/')
      .redirects(1)
      .expect(200);

    expect(res.headers['content-type']).toContain('text/html');
  });
});

describe('OpenAPI Integration: Generated document contains all registered paths', () => {
  it('contains all 12 registered paths', () => {
    const document = generateOpenApiDocument();

    const expectedPaths = [
      '/auth/login',
      '/users',
      '/tickets',
      '/tickets/{id}',
      '/tickets/{id}/status',
      '/tickets/{id}/comments',
      '/tags',
      '/tags/{id}',
      '/health',
    ];

    const documentPaths = Object.keys(document.paths ?? {});

    for (const path of expectedPaths) {
      expect(documentPaths).toContain(path);
    }
  });
});

describe('OpenAPI Integration: Generated document has valid OpenAPI 3.0 structure', () => {
  it('has openapi version 3.0.0', () => {
    const document = generateOpenApiDocument();
    expect(document.openapi).toBe('3.0.0');
  });

  it('has info.title and info.version', () => {
    const document = generateOpenApiDocument();
    expect(document.info.title).toBeDefined();
    expect(document.info.title).toBe('Support Ticket Management API');
    expect(document.info.version).toBeDefined();
    expect(document.info.version).toBe('1.0.0');
  });

  it('has paths object', () => {
    const document = generateOpenApiDocument();
    expect(document.paths).toBeDefined();
    expect(typeof document.paths).toBe('object');
  });

  it('has components.securitySchemes.BearerAuth', () => {
    const document = generateOpenApiDocument();
    expect(document.components?.securitySchemes?.BearerAuth).toBeDefined();
    expect((document.components?.securitySchemes?.BearerAuth as any).type).toBe('http');
    expect((document.components?.securitySchemes?.BearerAuth as any).scheme).toBe('bearer');
    expect((document.components?.securitySchemes?.BearerAuth as any).bearerFormat).toBe('JWT');
  });
});

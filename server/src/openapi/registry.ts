import { OpenAPIRegistry, extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

// Extend Zod with OpenAPI support once, before any schema uses .openapi()
extendZodWithOpenApi(z);

export const registry = new OpenAPIRegistry();

// Register Bearer auth security scheme
registry.registerComponent('securitySchemes', 'BearerAuth', {
  type: 'http',
  scheme: 'bearer',
  bearerFormat: 'JWT',
});

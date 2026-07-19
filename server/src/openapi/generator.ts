import { OpenApiGeneratorV3 } from '@asteasolutions/zod-to-openapi';
import { registry } from './registry';
import './routes/auth';
import './routes/tickets';
import './routes/users';
import './routes/tags';

export function generateOpenApiDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);
  return generator.generateDocument({
    openapi: '3.0.0',
    info: {
      title: 'Support Ticket Management API',
      version: '1.0.0',
      description: 'Internal API for managing support tickets, users, comments, and tags.',
    },
    servers: [{ url: '/api', description: 'API server' }],
  });
}

import { registry } from '../registry';
import { createTagSchema, deleteTagParamsSchema } from '../../schemas/tagSchemas';
import { TagResponseSchema, ErrorResponseSchema, HealthResponseSchema } from '../responseSchemas';
import { z } from 'zod';

// Register request schemas with OpenAPI metadata
createTagSchema.openapi('CreateTagRequest');
deleteTagParamsSchema.openapi('DeleteTagParams');

// POST /tags - Create a tag
registry.registerPath({
  method: 'post',
  path: '/tags',
  summary: 'Create a tag',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createTagSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Tag created successfully',
      content: {
        'application/json': {
          schema: TagResponseSchema,
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Duplicate tag name',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// GET /tags - List tags
registry.registerPath({
  method: 'get',
  path: '/tags',
  summary: 'List tags',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'List of tags',
      content: {
        'application/json': {
          schema: z.array(TagResponseSchema),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// DELETE /tags/{id} - Delete a tag
registry.registerPath({
  method: 'delete',
  path: '/tags/{id}',
  summary: 'Delete a tag',
  security: [{ BearerAuth: [] }],
  request: {
    params: deleteTagParamsSchema,
  },
  responses: {
    204: {
      description: 'Tag deleted successfully',
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Tag not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// GET /health - Health check (public endpoint, no auth)
registry.registerPath({
  method: 'get',
  path: '/health',
  summary: 'Health check',
  description: 'Check if the API server is running',
  responses: {
    200: {
      description: 'Server is healthy',
      content: {
        'application/json': {
          schema: HealthResponseSchema,
        },
      },
    },
  },
});

import { z } from 'zod';
import { registry } from '../registry';
import { UserResponseSchema, ErrorResponseSchema } from '../responseSchemas';

registry.registerPath({
  method: 'get',
  path: '/users',
  summary: 'List users',
  description: 'Retrieve all users in the system',
  security: [{ BearerAuth: [] }],
  responses: {
    200: {
      description: 'List of users',
      content: {
        'application/json': {
          schema: z.array(UserResponseSchema),
        },
      },
    },
    401: {
      description: 'Unauthorized',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

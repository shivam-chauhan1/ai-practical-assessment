import { registry } from '../registry';
import { loginSchema } from '../../schemas/authSchemas';
import { LoginResponseSchema, ErrorResponseSchema } from '../responseSchemas';

// Register the login schema with OpenAPI metadata
loginSchema.openapi('LoginRequest');

registry.registerPath({
  method: 'post',
  path: '/auth/login',
  summary: 'Authenticate user',
  description: 'Authenticate with email and password to receive a JWT token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: {
        'application/json': {
          schema: LoginResponseSchema,
        },
      },
    },
    401: {
      description: 'Invalid credentials',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

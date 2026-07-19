import { registry } from '../registry';
import {
  createTicketSchema,
  updateTicketSchema,
  changeStatusSchema,
  listTicketsQuerySchema,
  uuidParamSchema,
} from '../../schemas/ticketSchemas';
import { createCommentSchema } from '../../schemas/commentSchemas';
import {
  TicketResponseSchema,
  TicketListResponseSchema,
  CommentResponseSchema,
  ErrorResponseSchema,
} from '../responseSchemas';

// Register request schemas with OpenAPI metadata
createTicketSchema.openapi('CreateTicketRequest');
updateTicketSchema.openapi('UpdateTicketRequest');
changeStatusSchema.openapi('ChangeStatusRequest');
listTicketsQuerySchema.openapi('ListTicketsQuery');
uuidParamSchema.openapi('UuidParam');
createCommentSchema.openapi('CreateCommentRequest');

// POST /tickets - Create a ticket
registry.registerPath({
  method: 'post',
  path: '/tickets',
  summary: 'Create a ticket',
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: createTicketSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Ticket created successfully',
      content: {
        'application/json': {
          schema: TicketResponseSchema,
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
  },
});

// GET /tickets - List tickets
registry.registerPath({
  method: 'get',
  path: '/tickets',
  summary: 'List tickets',
  description: 'Retrieve a paginated list of tickets with optional filters',
  security: [{ BearerAuth: [] }],
  request: {
    query: listTicketsQuerySchema,
  },
  responses: {
    200: {
      description: 'Paginated list of tickets',
      content: {
        'application/json': {
          schema: TicketListResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid query parameters',
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
  },
});

// GET /tickets/{id} - Get a ticket
registry.registerPath({
  method: 'get',
  path: '/tickets/{id}',
  summary: 'Get a ticket',
  security: [{ BearerAuth: [] }],
  request: {
    params: uuidParamSchema,
  },
  responses: {
    200: {
      description: 'Ticket details',
      content: {
        'application/json': {
          schema: TicketResponseSchema,
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
    404: {
      description: 'Ticket not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// PATCH /tickets/{id} - Update a ticket
registry.registerPath({
  method: 'patch',
  path: '/tickets/{id}',
  summary: 'Update a ticket',
  security: [{ BearerAuth: [] }],
  request: {
    params: uuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: updateTicketSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Ticket updated successfully',
      content: {
        'application/json': {
          schema: TicketResponseSchema,
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
    403: {
      description: 'Ticket is locked',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Ticket not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// PATCH /tickets/{id}/status - Change ticket status
registry.registerPath({
  method: 'patch',
  path: '/tickets/{id}/status',
  summary: 'Change ticket status',
  description:
    "Change a ticket's status. Only ADMIN users can perform this action. Valid transitions: OPEN→IN_PROGRESS, IN_PROGRESS→RESOLVED, RESOLVED→CLOSED, OPEN→CANCELLED, IN_PROGRESS→CANCELLED. No other transitions are allowed.",
  security: [{ BearerAuth: [] }],
  request: {
    params: uuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: changeStatusSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Status changed successfully',
      content: {
        'application/json': {
          schema: TicketResponseSchema,
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
    403: {
      description: 'Not admin or ticket is locked',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Ticket not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    409: {
      description: 'Invalid status transition',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// POST /tickets/{id}/comments - Add a comment to a ticket
registry.registerPath({
  method: 'post',
  path: '/tickets/{id}/comments',
  summary: 'Add a comment to a ticket',
  security: [{ BearerAuth: [] }],
  request: {
    params: uuidParamSchema,
    body: {
      content: {
        'application/json': {
          schema: createCommentSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Comment added successfully',
      content: {
        'application/json': {
          schema: CommentResponseSchema,
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
    404: {
      description: 'Ticket not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

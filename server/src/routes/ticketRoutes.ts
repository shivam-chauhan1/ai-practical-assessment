import { Router } from 'express';
import { validate } from '../middleware/validate';
import { authenticate } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/roleGuard';
import { createTicketSchema, updateTicketSchema, changeStatusSchema, listTicketsQuerySchema, uuidParamSchema } from '../schemas/ticketSchemas';
import { createCommentSchema } from '../schemas/commentSchemas';
import * as ticketController from '../controllers/ticketController';
import * as commentController from '../controllers/commentController';

const router = Router();

// All ticket routes require authentication
router.use(authenticate);

router.post('/tickets', validate(createTicketSchema), ticketController.createTicket);
router.get('/tickets', validate(listTicketsQuerySchema, 'query'), ticketController.listTickets);
router.get('/tickets/:id', validate(uuidParamSchema, 'params'), ticketController.getTicket);
router.patch('/tickets/:id', validate(uuidParamSchema, 'params'), validate(updateTicketSchema), ticketController.updateTicket);
router.patch('/tickets/:id/status', validate(uuidParamSchema, 'params'), requireRole('ADMIN'), validate(changeStatusSchema), ticketController.changeStatus);
router.post('/tickets/:id/comments', validate(uuidParamSchema, 'params'), validate(createCommentSchema), commentController.addComment);

export default router;

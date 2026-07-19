import { Router } from 'express';
import { validate } from '../middleware/validate';
import { createTicketSchema, updateTicketSchema, changeStatusSchema, listTicketsQuerySchema } from '../schemas/ticketSchemas';
import { createCommentSchema } from '../schemas/commentSchemas';
import * as ticketController from '../controllers/ticketController';
import * as commentController from '../controllers/commentController';

const router = Router();

router.post('/tickets', validate(createTicketSchema), ticketController.createTicket);
router.get('/tickets', validate(listTicketsQuerySchema, 'query'), ticketController.listTickets);
router.get('/tickets/:id', ticketController.getTicket);
router.patch('/tickets/:id', validate(updateTicketSchema), ticketController.updateTicket);
router.patch('/tickets/:id/status', validate(changeStatusSchema), ticketController.changeStatus);
router.post('/tickets/:id/comments', validate(createCommentSchema), commentController.addComment);

export default router;

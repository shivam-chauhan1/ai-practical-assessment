import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { createTagSchema, deleteTagParamsSchema } from '../schemas/tagSchemas';
import * as tagController from '../controllers/tagController';

const router = Router();

// All tag routes require authentication
router.use(authenticate);

router.post('/tags', validate(createTagSchema), tagController.create);
router.get('/tags', tagController.list);
router.delete('/tags/:id', validate(deleteTagParamsSchema, 'params'), tagController.remove);

export default router;

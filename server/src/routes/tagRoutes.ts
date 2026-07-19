import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as tagController from '../controllers/tagController';

const router = Router();

// All tag routes require authentication
router.use(authenticate);

router.post('/tags', tagController.create);
router.get('/tags', tagController.list);
router.delete('/tags/:id', tagController.remove);

export default router;

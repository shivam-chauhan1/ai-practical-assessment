import { Router } from 'express';
import * as tagController from '../controllers/tagController';

const router = Router();

router.post('/tags', tagController.create);
router.get('/tags', tagController.list);
router.delete('/tags/:id', tagController.remove);

export default router;

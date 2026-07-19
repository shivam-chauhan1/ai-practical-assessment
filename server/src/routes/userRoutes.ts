import { Router } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import * as userController from '../controllers/userController';

const router = Router();

// All user routes require authentication
router.use(authenticate);

router.get('/users', userController.listUsers);

export default router;

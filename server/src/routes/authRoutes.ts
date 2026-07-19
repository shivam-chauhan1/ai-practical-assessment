import { Router } from 'express';
import { validate } from '../middleware/validate';
import { loginSchema } from '../schemas/authSchemas';
import * as authController from '../controllers/authController';

const router = Router();

router.post('/auth/login', validate(loginSchema), authController.login);

export default router;

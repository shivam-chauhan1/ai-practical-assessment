import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/userService';

export async function listUsers(_req: Request, res: Response, next: NextFunction) {
  try {
    const users = await userService.listUsers();
    res.json(users);
  } catch (err) {
    next(err);
  }
}

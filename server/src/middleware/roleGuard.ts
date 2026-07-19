import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ForbiddenError } from '../errors';

export function requireRole(...roles: string[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new ForbiddenError('Only ADMIN users can change ticket status');
    }
    next();
  };
}

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { ValidationError } from '../errors';

export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      req[source] = parsed;
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const details = err.issues.map(issue => ({
          field: issue.path.join('.') || 'unknown',
          message: issue.message,
        }));
        next(new ValidationError('Request validation failed', details));
      } else {
        next(err);
      }
    }
  };
}

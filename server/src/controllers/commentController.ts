import { Request, Response, NextFunction } from 'express';
import * as commentService from '../services/commentService';

export async function addComment(req: Request, res: Response, next: NextFunction) {
  try {
    const comment = await commentService.addComment({
      ticketId: req.params.id,
      body: req.body.body,
      authorId: req.body.authorId,
    });
    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}

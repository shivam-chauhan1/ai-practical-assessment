import { Request, Response, NextFunction } from 'express';
import * as tagService from '../services/tagService';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const tag = await tagService.createTag(req.body.name);
    res.status(201).json(tag);
  } catch (err) {
    next(err);
  }
}

export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await tagService.listTags();
    res.status(200).json(tags);
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await tagService.deleteTag(req.params.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

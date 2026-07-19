import { Request, Response, NextFunction } from 'express';
import { createTagSchema, deleteTagParamsSchema } from '../schemas/tagSchemas';
import * as tagService from '../services/tagService';

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createTagSchema.parse(req.body);
    const tag = await tagService.createTag(parsed.name);
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
    const parsed = deleteTagParamsSchema.parse(req.params);
    await tagService.deleteTag(parsed.id);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

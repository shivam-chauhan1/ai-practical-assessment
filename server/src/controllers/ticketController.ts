import { Request, Response, NextFunction } from 'express';
import { Status, Priority } from '@prisma/client';
import * as ticketService from '../services/ticketService';
import { ValidationError } from '../errors';

/**
 * Represents the shape of req.query after Zod validation for the list tickets endpoint.
 */
interface ParsedListTicketsQuery {
  keyword?: string;
  status?: Status;
  tag?: string;
  priority?: Priority;
  assignedTo?: string;
  sortBy?: 'updatedAt' | 'priority';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export async function createTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.createTicket(req.body);
    res.status(201).json(ticket);
  } catch (err) {
    next(err);
  }
}

export async function listTickets(req: Request, res: Response, next: NextFunction) {
  try {
    const {
      keyword, status, tag,
      priority, assignedTo,
      sortBy, sortOrder,
      page, pageSize,
    } = req.query as unknown as ParsedListTicketsQuery;

    let tagIds: string[] | undefined;
    if (tag) {
      tagIds = (tag as string).split(',').filter(Boolean);
      if (tagIds.length > 10) {
        throw new ValidationError('Maximum 10 tag filter IDs');
      }
    }

    const result = await ticketService.listTickets({
      keyword,
      status,
      tagIds,
      priority,
      assignedTo,
      sortBy: sortBy ?? 'updatedAt',
      sortOrder: sortOrder ?? 'desc',
      page: page ?? 1,
      pageSize: pageSize ?? 20,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.getTicketById(req.params.id);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
}

export async function updateTicket(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.updateTicket(req.params.id, req.body);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
}

export async function changeStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const ticket = await ticketService.changeTicketStatus(req.params.id, req.body.status);
    res.json(ticket);
  } catch (err) {
    next(err);
  }
}

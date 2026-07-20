import { Request, Response, NextFunction } from 'express';
import { Status } from '@prisma/client';
import * as ticketService from '../services/ticketService';
import { ValidationError } from '../errors';

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
    const { keyword, status, tag } = req.query as { keyword?: string; status?: Status; tag?: string };

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

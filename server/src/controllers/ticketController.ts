import { Request, Response, NextFunction } from 'express';
import * as ticketService from '../services/ticketService';

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
    const filters = req.query as { keyword?: string; status?: any };
    const tickets = await ticketService.listTickets(filters);
    res.json(tickets);
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

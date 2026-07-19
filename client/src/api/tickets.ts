import { apiRequest } from './client';
import type {
  Ticket,
  TicketWithComments,
  CreateTicketRequest,
  UpdateTicketRequest,
  ChangeStatusRequest,
  TicketSearchParams,
} from './types';

export async function createTicket(data: CreateTicketRequest): Promise<Ticket> {
  return apiRequest<Ticket>('/tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listTickets(params?: TicketSearchParams): Promise<Ticket[]> {
  const searchParams = new URLSearchParams();
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.tag) searchParams.set('tag', params.tag);
  const query = searchParams.toString();
  return apiRequest<Ticket[]>(`/tickets${query ? `?${query}` : ''}`);
}

export async function getTicket(id: string): Promise<TicketWithComments> {
  return apiRequest<TicketWithComments>(`/tickets/${id}`);
}

export async function updateTicket(id: string, data: UpdateTicketRequest): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export async function changeTicketStatus(id: string, data: ChangeStatusRequest): Promise<Ticket> {
  return apiRequest<Ticket>(`/tickets/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

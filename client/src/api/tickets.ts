import { apiRequest } from './client';
import type {
  Ticket,
  TicketWithComments,
  CreateTicketRequest,
  UpdateTicketRequest,
  ChangeStatusRequest,
  TicketListParams,
  PaginatedTicketsResponse,
} from './types';

export async function createTicket(data: CreateTicketRequest): Promise<Ticket> {
  return apiRequest<Ticket>('/tickets', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function listTickets(params?: TicketListParams): Promise<PaginatedTicketsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  if (params?.status) searchParams.set('status', params.status);
  if (params?.tag) searchParams.set('tag', params.tag);
  if (params?.priority) searchParams.set('priority', params.priority);
  if (params?.assignedTo) searchParams.set('assignedTo', params.assignedTo);
  if (params?.sortBy) searchParams.set('sortBy', params.sortBy);
  if (params?.sortOrder) searchParams.set('sortOrder', params.sortOrder);
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.pageSize) searchParams.set('pageSize', String(params.pageSize));
  const query = searchParams.toString();
  return apiRequest<PaginatedTicketsResponse>(`/tickets${query ? `?${query}` : ''}`);
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

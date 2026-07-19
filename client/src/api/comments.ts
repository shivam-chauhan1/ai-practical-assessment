import { apiRequest } from './client';
import type { Comment, CreateCommentRequest } from './types';

export async function addComment(ticketId: string, data: CreateCommentRequest): Promise<Comment> {
  return apiRequest<Comment>(`/tickets/${ticketId}/comments`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

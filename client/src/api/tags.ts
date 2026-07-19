import { apiRequest, ApiError } from './client';
import type { Tag, CreateTagRequest } from './types';

export async function listTags(): Promise<Tag[]> {
  return apiRequest<Tag[]>('/tags');
}

export async function createTag(data: CreateTagRequest): Promise<Tag> {
  return apiRequest<Tag>('/tags', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteTag(id: string): Promise<void> {
  let response: Response;

  try {
    response = await fetch(`/api/tags/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Server is unavailable. Please try again later.');
  }

  if (!response.ok) {
    let errorBody;
    try {
      errorBody = await response.json();
    } catch {
      throw new ApiError(response.status, 'UNKNOWN_ERROR', 'An unexpected error occurred');
    }
    throw new ApiError(
      response.status,
      errorBody.error.code,
      errorBody.error.message,
      errorBody.error.details
    );
  }
}

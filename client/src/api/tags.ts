import { apiRequest } from './client';
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
  await apiRequest<void>(`/tags/${id}`, { method: 'DELETE' });
}

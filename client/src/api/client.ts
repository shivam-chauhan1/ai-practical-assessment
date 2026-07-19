import type { ApiErrorResponse } from './types';

export class ApiError extends Error {
  statusCode: number;
  code: string;
  details?: Array<{ field: string; message: string }>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

const BASE_URL = '/api';

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Server is unavailable. Please try again later.');
  }

  if (!response.ok) {
    let errorBody: ApiErrorResponse;
    try {
      errorBody = await response.json() as ApiErrorResponse;
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

  return response.json() as Promise<T>;
}

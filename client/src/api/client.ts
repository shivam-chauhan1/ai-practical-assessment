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

// Auth configuration injected by the app at startup
let tokenGetter: (() => string | null) | null = null;
let onUnauthorized: (() => void) | null = null;

/**
 * Configure the API client with auth callbacks.
 * @param getToken - Returns the current JWT token or null
 * @param unauthorizedCallback - Called on 401 to clear token and redirect
 */
export function setAuthConfig(
  getToken: () => string | null,
  unauthorizedCallback: () => void
): void {
  tokenGetter = getToken;
  onUnauthorized = unauthorizedCallback;
}

/**
 * Determines whether a given path is a protected route that needs auth headers.
 * Auth paths like /auth/login should NOT get the auth header.
 * All other API paths are considered protected.
 */
function isProtectedPath(path: string): boolean {
  return !path.startsWith('/auth/');
}

export async function apiRequest<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  // Attach Authorization header for protected paths when token is present
  if (isProtectedPath(path) && tokenGetter) {
    const token = tokenGetter();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  let response: Response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'Server is unavailable. Please try again later.');
  }

  // Handle 401 Unauthorized — clear token, redirect to login
  if (response.status === 401 && isProtectedPath(path)) {
    if (onUnauthorized) {
      onUnauthorized();
    }
    throw new ApiError(401, 'SESSION_EXPIRED', 'Your session has expired. Please log in again.');
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

  // 204 No Content — return undefined (caller should use Promise<void>)
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest, setAuthConfig, ApiError } from '../src/api/client';

describe('API Client - Authenticated Requests', () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    // Reset auth config between tests
    setAuthConfig(() => null, () => {});
    vi.restoreAllMocks();
  });

  function mockSuccessResponse(data: unknown) {
    return {
      ok: true,
      status: 200,
      json: () => Promise.resolve(data),
    };
  }

  function mockErrorResponse(status: number, body: unknown) {
    return {
      ok: false,
      status,
      json: () => Promise.resolve(body),
    };
  }

  describe('Authorization header attachment', () => {
    it('should attach Authorization header to /tickets requests when token is present', async () => {
      setAuthConfig(() => 'my-jwt-token', () => {});
      mockFetch.mockResolvedValue(mockSuccessResponse([]));

      await apiRequest('/tickets');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tickets',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        })
      );
    });

    it('should attach Authorization header to /tickets sub-routes', async () => {
      setAuthConfig(() => 'my-jwt-token', () => {});
      mockFetch.mockResolvedValue(mockSuccessResponse({}));

      await apiRequest('/tickets/123/comments');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tickets/123/comments',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        })
      );
    });

    it('should omit Authorization header when token is null', async () => {
      setAuthConfig(() => null, () => {});
      mockFetch.mockResolvedValue(mockSuccessResponse([]));

      await apiRequest('/tickets');

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });

    it('should omit Authorization header when no auth config is set', async () => {
      // Reset to default state (no tokenGetter)
      setAuthConfig(() => null, () => {});
      mockFetch.mockResolvedValue(mockSuccessResponse([]));

      await apiRequest('/tickets');

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });

    it('should NOT attach Authorization header to /auth/login requests', async () => {
      setAuthConfig(() => 'my-jwt-token', () => {});
      mockFetch.mockResolvedValue(mockSuccessResponse({ token: 'abc', user: {} }));

      await apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'pass' }),
      });

      const callHeaders = mockFetch.mock.calls[0][1].headers;
      expect(callHeaders).not.toHaveProperty('Authorization');
    });

    it('should attach Authorization header to non-ticket protected paths like /users', async () => {
      setAuthConfig(() => 'my-jwt-token', () => {});
      mockFetch.mockResolvedValue(mockSuccessResponse([]));

      await apiRequest('/users');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        })
      );
    });

    it('should attach Authorization header to /tags routes', async () => {
      setAuthConfig(() => 'my-jwt-token', () => {});
      mockFetch.mockResolvedValue(mockSuccessResponse([]));

      await apiRequest('/tags');

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/tags',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-jwt-token',
          }),
        })
      );
    });
  });

  describe('401 response handling', () => {
    it('should call onUnauthorized and throw SESSION_EXPIRED error on 401 from protected route', async () => {
      const onUnauthorized = vi.fn();
      setAuthConfig(() => 'expired-token', onUnauthorized);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { code: 'AUTH', message: 'Expired' } }),
      });

      await expect(apiRequest('/tickets')).rejects.toThrow(ApiError);
      await expect(apiRequest('/tickets')).rejects.toMatchObject({
        statusCode: 401,
        code: 'SESSION_EXPIRED',
      });
      expect(onUnauthorized).toHaveBeenCalled();
    });

    it('should NOT call onUnauthorized on 401 from non-protected route (e.g., /auth/login)', async () => {
      const onUnauthorized = vi.fn();
      setAuthConfig(() => null, onUnauthorized);
      mockFetch.mockResolvedValue(mockErrorResponse(401, {
        error: { code: 'AUTHENTICATION_ERROR', message: 'Invalid email or password' },
      }));

      await expect(apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: 'a@b.com', password: 'wrong' }),
      })).rejects.toThrow(ApiError);

      expect(onUnauthorized).not.toHaveBeenCalled();
    });

    it('should reject with session-expired error message on 401', async () => {
      const onUnauthorized = vi.fn();
      setAuthConfig(() => 'expired-token', onUnauthorized);
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { code: 'AUTH', message: 'Token expired' } }),
      });

      try {
        await apiRequest('/tickets');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).message).toContain('session has expired');
      }
    });
  });

  describe('non-auth error handling (unchanged behavior)', () => {
    it('should throw ApiError with parsed error body on non-401 errors', async () => {
      setAuthConfig(() => 'token', () => {});
      mockFetch.mockResolvedValue(mockErrorResponse(400, {
        error: { code: 'VALIDATION_ERROR', message: 'Title is required' },
      }));

      await expect(apiRequest('/tickets', {
        method: 'POST',
        body: JSON.stringify({}),
      })).rejects.toMatchObject({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Title is required',
      });
    });

    it('should throw NETWORK_ERROR when fetch itself fails', async () => {
      setAuthConfig(() => 'token', () => {});
      mockFetch.mockRejectedValue(new Error('Network failure'));

      await expect(apiRequest('/tickets')).rejects.toMatchObject({
        statusCode: 0,
        code: 'NETWORK_ERROR',
      });
    });
  });
});

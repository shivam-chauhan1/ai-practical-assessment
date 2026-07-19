import { Request, Response, NextFunction } from 'express';
import { AuthenticationError } from '../src/errors';

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  verify: jest.fn(),
  TokenExpiredError: class TokenExpiredError extends Error {
    constructor() {
      super('jwt expired');
      this.name = 'TokenExpiredError';
    }
  },
  JsonWebTokenError: class JsonWebTokenError extends Error {
    constructor() {
      super('invalid token');
      this.name = 'JsonWebTokenError';
    }
  },
}));

// Mock config
jest.mock('../src/config', () => ({
  config: {
    jwt: {
      secret: 'test-secret-that-is-at-least-32-chars-long',
      expiresIn: '1h',
    },
  },
}));

import jwt from 'jsonwebtoken';
import { authenticate } from '../src/middleware/authMiddleware';

function createMockReq(authHeader?: string): Partial<Request> {
  return {
    headers: {
      ...(authHeader !== undefined ? { authorization: authHeader } : {}),
    },
  } as Partial<Request>;
}

function createMockRes(): Partial<Response> {
  return {};
}

describe('Auth Middleware - authenticate', () => {
  let mockNext: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNext = jest.fn();
  });

  it('should decode valid token and attach user to request', () => {
    const payload = { id: 'user-123', email: 'alice@example.com', role: 'ADMIN' };
    (jwt.verify as jest.Mock).mockReturnValue(payload);

    const req = createMockReq('Bearer valid-token-string');

    authenticate(req as Request, createMockRes() as Response, mockNext);

    expect(jwt.verify).toHaveBeenCalledWith('valid-token-string', 'test-secret-that-is-at-least-32-chars-long');
    expect((req as any).user).toEqual({
      id: 'user-123',
      email: 'alice@example.com',
      role: 'ADMIN',
    });
    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  it('should throw AuthenticationError with "Token expired" for expired token', () => {
    const expiredError = new (jwt as any).TokenExpiredError();
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw expiredError;
    });

    const req = createMockReq('Bearer expired-token');

    expect(() => {
      authenticate(req as Request, createMockRes() as Response, mockNext);
    }).toThrow(AuthenticationError);

    expect(() => {
      authenticate(req as Request, createMockRes() as Response, mockNext);
    }).toThrow('Token expired');

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw AuthenticationError with "Invalid token" for malformed token', () => {
    const jsonWebTokenError = new (jwt as any).JsonWebTokenError();
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw jsonWebTokenError;
    });

    const req = createMockReq('Bearer malformed-token');

    expect(() => {
      authenticate(req as Request, createMockRes() as Response, mockNext);
    }).toThrow(AuthenticationError);

    expect(() => {
      authenticate(req as Request, createMockRes() as Response, mockNext);
    }).toThrow('Invalid token');

    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw AuthenticationError with "Authentication required" when header is missing', () => {
    const req = createMockReq(undefined);

    expect(() => {
      authenticate(req as Request, createMockRes() as Response, mockNext);
    }).toThrow(AuthenticationError);

    expect(() => {
      authenticate(req as Request, createMockRes() as Response, mockNext);
    }).toThrow('Authentication required');

    expect(jwt.verify).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should throw AuthenticationError with "Authentication required" when header does not start with "Bearer "', () => {
    const req = createMockReq('Basic token123');

    expect(() => {
      authenticate(req as Request, createMockRes() as Response, mockNext);
    }).toThrow(AuthenticationError);

    expect(() => {
      authenticate(req as Request, createMockRes() as Response, mockNext);
    }).toThrow('Authentication required');

    expect(jwt.verify).not.toHaveBeenCalled();
    expect(mockNext).not.toHaveBeenCalled();
  });
});

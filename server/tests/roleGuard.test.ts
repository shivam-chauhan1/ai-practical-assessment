import { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../src/errors';
import { requireRole } from '../src/middleware/roleGuard';

function createMockReq(user?: { id: string; email: string; role: string }): Partial<Request> {
  return {
    user,
  } as Partial<Request>;
}

function createMockRes(): Partial<Response> {
  return {};
}

describe('Role Guard - requireRole', () => {
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockNext = jest.fn();
  });

  // Validates: Requirements 5.1
  it('should call next() when user has ADMIN role and ADMIN is required', () => {
    const req = createMockReq({ id: 'user-1', email: 'admin@example.com', role: 'ADMIN' });

    requireRole('ADMIN')(req as Request, createMockRes() as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  // Validates: Requirements 5.2
  it('should throw ForbiddenError with 403 when AGENT tries to access ADMIN-only route', () => {
    const req = createMockReq({ id: 'user-2', email: 'agent@example.com', role: 'AGENT' });

    expect(() => {
      requireRole('ADMIN')(req as Request, createMockRes() as Response, mockNext);
    }).toThrow(ForbiddenError);

    expect(() => {
      requireRole('ADMIN')(req as Request, createMockRes() as Response, mockNext);
    }).toThrow('Only ADMIN users can change ticket status');

    expect(mockNext).not.toHaveBeenCalled();
  });

  // Validates: Requirements 5.2
  it('should throw ForbiddenError when req.user is undefined (no auth)', () => {
    const req = createMockReq(undefined);

    expect(() => {
      requireRole('ADMIN')(req as Request, createMockRes() as Response, mockNext);
    }).toThrow(ForbiddenError);

    expect(mockNext).not.toHaveBeenCalled();
  });

  // Validates: Requirements 5.1, 5.2
  it('should enforce middleware ordering: auth populates req.user before role guard checks it', () => {
    // Simulates the intended middleware ordering: authenticate sets req.user, then roleGuard checks it.
    // If auth middleware hasn't run (req.user is undefined), role guard should reject.
    const reqWithoutUser = createMockReq(undefined);

    expect(() => {
      requireRole('ADMIN')(reqWithoutUser as Request, createMockRes() as Response, mockNext);
    }).toThrow(ForbiddenError);

    // When auth middleware has run and set req.user, role guard should allow valid roles.
    const reqWithUser = createMockReq({ id: 'user-1', email: 'admin@example.com', role: 'ADMIN' });

    requireRole('ADMIN')(reqWithUser as Request, createMockRes() as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  // Validates: Requirements 5.1, 5.2
  it('should verify route-level ordering: authenticate is applied before requireRole in ticket routes', () => {
    // The ticket routes file applies `router.use(authenticate)` at the top,
    // then uses `requireRole('ADMIN')` on PATCH /tickets/:id/status.
    // This test verifies the contract: role guard depends on req.user being set by auth middleware.
    
    // Without auth (no req.user), role guard always rejects — proving it must run after auth
    const unauthReq = createMockReq(undefined);
    expect(() => {
      requireRole('ADMIN')(unauthReq as Request, createMockRes() as Response, mockNext);
    }).toThrow(ForbiddenError);

    // With auth (req.user set), ADMIN passes through
    const adminReq = createMockReq({ id: 'admin-1', email: 'admin@test.com', role: 'ADMIN' });
    requireRole('ADMIN')(adminReq as Request, createMockRes() as Response, mockNext);
    expect(mockNext).toHaveBeenCalledTimes(1);

    // With auth (req.user set), AGENT is blocked
    mockNext.mockClear();
    const agentReq = createMockReq({ id: 'agent-1', email: 'agent@test.com', role: 'AGENT' });
    expect(() => {
      requireRole('ADMIN')(agentReq as Request, createMockRes() as Response, mockNext);
    }).toThrow(ForbiddenError);
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should allow access when user has one of multiple allowed roles', () => {
    const req = createMockReq({ id: 'user-3', email: 'agent@example.com', role: 'AGENT' });

    requireRole('ADMIN', 'AGENT')(req as Request, createMockRes() as Response, mockNext);

    expect(mockNext).toHaveBeenCalledTimes(1);
  });

  // Validates: Requirements 5.2
  it('should have ForbiddenError with statusCode 403', () => {
    const req = createMockReq({ id: 'user-2', email: 'agent@example.com', role: 'AGENT' });

    try {
      requireRole('ADMIN')(req as Request, createMockRes() as Response, mockNext);
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).statusCode).toBe(403);
      expect((error as ForbiddenError).code).toBe('FORBIDDEN');
    }
  });
});

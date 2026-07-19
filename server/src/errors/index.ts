export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Array<{ field: string; message: string }>
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, 'NOT_FOUND', message);
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, NotFoundError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Array<{ field: string; message: string }>) {
    super(400, 'VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

export class TicketLockedError extends AppError {
  constructor(message: string = 'Ticket is locked due to its terminal status') {
    super(403, 'TICKET_LOCKED', message);
    this.name = 'TicketLockedError';
    Object.setPrototypeOf(this, TicketLockedError.prototype);
  }
}

export class InvalidTransitionError extends AppError {
  constructor(from: string, to: string, validTransitions: string[]) {
    const message = `Cannot transition from ${from} to ${to}. Valid transitions: ${validTransitions.join(', ') || 'none'}`;
    super(400, 'INVALID_TRANSITION', message);
    this.name = 'InvalidTransitionError';
    Object.setPrototypeOf(this, InvalidTransitionError.prototype);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, 'CONFLICT', message);
    this.name = 'ConflictError';
    Object.setPrototypeOf(this, ConflictError.prototype);
  }
}

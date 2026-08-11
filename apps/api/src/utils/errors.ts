// ─────────────────────────────────────────────────────────────
// Base application error — all custom errors extend this
// ─────────────────────────────────────────────────────────────
export class AppError extends Error {
  public readonly statusCode: number
  public readonly code: string
  public readonly details?: Record<string, unknown>
  public readonly isOperational: boolean  // true = expected error, false = bug

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: Record<string, unknown>,
    isOperational = true
  ) {
    super(message)
    this.name = this.constructor.name
    this.statusCode = statusCode
    this.code = code
    this.details = details
    this.isOperational = isOperational

    // Maintains proper stack trace in V8
    Error.captureStackTrace(this, this.constructor)
  }
}

// ─────────────────────────────────────────────────────────────
// 400 Bad Request — malformed input, business rule violation
// ─────────────────────────────────────────────────────────────
export class BadRequestError extends AppError {
  constructor(message: string, code = 'BAD_REQUEST', details?: Record<string, unknown>) {
    super(message, 400, code, details)
  }
}

// ─────────────────────────────────────────────────────────────
// 401 Unauthorized — not logged in, invalid/expired token
// ─────────────────────────────────────────────────────────────
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(message, 401, code)
  }
}

// ─────────────────────────────────────────────────────────────
// 403 Forbidden — logged in but not allowed
// ─────────────────────────────────────────────────────────────
export class ForbiddenError extends AppError {
  constructor(message = 'You do not have permission to perform this action', code = 'FORBIDDEN') {
    super(message, 403, code)
  }
}

// ─────────────────────────────────────────────────────────────
// 404 Not Found
// ─────────────────────────────────────────────────────────────
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(message, 404, code)
  }
}

// ─────────────────────────────────────────────────────────────
// 409 Conflict — duplicate booking, existing record
// ─────────────────────────────────────────────────────────────
export class ConflictError extends AppError {
  constructor(message: string, code = 'CONFLICT', details?: Record<string, unknown>) {
    super(message, 409, code, details)
  }
}

// ─────────────────────────────────────────────────────────────
// 422 Validation Error — Zod schema failures
// ─────────────────────────────────────────────────────────────
export class ValidationError extends AppError {
  constructor(fields: Record<string, string>) {
    super('Validation failed', 422, 'VALIDATION_ERROR', { fields })
  }
}

// ─────────────────────────────────────────────────────────────
// 429 Rate Limited
// ─────────────────────────────────────────────────────────────
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please try again later.') {
    super(message, 429, 'RATE_LIMITED')
  }
}
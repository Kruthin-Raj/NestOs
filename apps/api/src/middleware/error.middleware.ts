import { Request, Response, NextFunction } from 'express'
import { ZodError } from 'zod'
import { AppError } from '@utils/errors'
import { logger } from '@utils/logger'
import { env } from '@config/env'

// ─────────────────────────────────────────────────────────────
// Global error handler — must be registered LAST in app.ts
// Express identifies error middleware by its 4 parameters
// ─────────────────────────────────────────────────────────────
export function globalErrorHandler(
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // ── Log the error ──────────────────────────────────────────
  logger.error(
    `${req.method} ${req.path} — ${err.message}`,
    'ErrorHandler',
    err
  )

  // ── Handle our custom AppError subclasses ─────────────────
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      error: {
        code: err.code,
        ...(err.details && { details: err.details }),
      },
    })
    return
  }

  // ── Handle Zod validation errors (should be caught by validate middleware,
  //    but add this as a safety net) ─────────────────────────
  if (err instanceof ZodError) {
    const fields: Record<string, string> = {}
    for (const issue of err.issues) {
      const path = issue.path.join('.')
      if (!fields[path]) fields[path] = issue.message
    }
    res.status(422).json({
      success: false,
      message: 'Validation failed',
      error: { code: 'VALIDATION_ERROR', details: { fields } },
    })
    return
  }

  // ── Handle Prisma known errors ────────────────────────────
  // P2002 = unique constraint violation
  if ((err as { code?: string }).code === 'P2002') {
    const target = (err as { meta?: { target?: string[] } }).meta?.target?.join(', ')
    res.status(409).json({
      success: false,
      message: `A record with this ${target ?? 'value'} already exists.`,
      error: { code: 'DUPLICATE_RECORD' },
    })
    return
  }

  // P2025 = record not found (Prisma findFirstOrThrow, etc.)
  if ((err as { code?: string }).code === 'P2025') {
    res.status(404).json({
      success: false,
      message: 'The requested resource was not found.',
      error: { code: 'NOT_FOUND' },
    })
    return
  }

  // ── Unknown / unexpected errors ───────────────────────────
  // In production: hide the actual error details from the client
  // In development: expose the message to help debugging
  const message = env.isDevelopment
    ? err.message
    : 'An unexpected error occurred. Please try again.'

  res.status(500).json({
    success: false,
    message,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      ...(env.isDevelopment && { stack: err.stack }),
    },
  })
}

// ─────────────────────────────────────────────────────────────
// 404 handler — registered AFTER all routes, BEFORE error handler
// Catches requests to routes that don't exist
// ─────────────────────────────────────────────────────────────
export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  const err = new AppError(
    `Route not found: ${req.method} ${req.path}`,
    404,
    'ROUTE_NOT_FOUND'
  )
  next(err)
}
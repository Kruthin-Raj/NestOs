import { Request, Response, NextFunction } from 'express'
import { ZodSchema, ZodError } from 'zod'
import { ValidationError } from '@utils/errors'

// ─────────────────────────────────────────────────────────────
// validate — validates req.body against a Zod schema
// If validation fails: throws a ValidationError with field-level messages
// If validation passes: sets req.body to the parsed (type-safe) data
//
// Usage on a route:
//   router.post('/buildings', authenticate, validate(createBuildingSchema), controller)
// ─────────────────────────────────────────────────────────────
export function validate(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)

    if (!result.success) {
      // Convert Zod's nested error format into flat field → message map
      const fields = flattenZodErrors(result.error)
      return next(new ValidationError(fields))
    }

    // Replace req.body with the parsed, type-coerced data
    req.body = result.data
    next()
  }
}

// ─────────────────────────────────────────────────────────────
// validateQuery — validates req.query against a Zod schema
// ─────────────────────────────────────────────────────────────
export function validateQuery(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query)

    if (!result.success) {
      const fields = flattenZodErrors(result.error)
      return next(new ValidationError(fields))
    }

    Object.assign(req.query, result.data)
    next()
  }
}

// ─────────────────────────────────────────────────────────────
// validateParams — validates req.params against a Zod schema
// ─────────────────────────────────────────────────────────────
export function validateParams(schema: ZodSchema) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params)

    if (!result.success) {
      const fields = flattenZodErrors(result.error)
      return next(new ValidationError(fields))
    }

    Object.assign(req.params, result.data)
    next()
  }
}

// ─────────────────────────────────────────────────────────────
// Helper: flatten Zod's nested error structure into
// { "fieldName": "Error message", "nested.field": "Error message" }
// ─────────────────────────────────────────────────────────────
function flattenZodErrors(error: ZodError): Record<string, string> {
  const fields: Record<string, string> = {}

  for (const issue of error.issues) {
    const path = issue.path.join('.')
    // Only store the first error per field
    if (!fields[path]) {
      fields[path] = issue.message
    }
  }

  return fields
}
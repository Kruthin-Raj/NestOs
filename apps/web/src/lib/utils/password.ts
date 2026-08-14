import { z } from 'zod'

/**
 * Mirrors the API rule in apps/api/src/modules/auth/auth.validation.ts.
 *
 * Deliberately modest — length carries most of the strength, and rules people
 * resent lead to worse passwords, not better ones.
 */
export const passwordField = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be under 72 characters')
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number')

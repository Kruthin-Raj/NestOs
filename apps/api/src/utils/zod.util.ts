import { z } from 'zod'

/**
 * Treats an empty (or whitespace-only) string as "not provided".
 *
 * An untouched text input posts `""`, not `undefined`, so `.optional()` alone
 * never applies and any `.regex()` on the field rejects the whole request. That
 * is what made "add building" fail whenever the optional contact phone was left
 * blank, and what stored floors with an empty-string label.
 *
 *   contactPhone: optional(phone)   // "" -> undefined, so .optional() applies
 */
export function optional<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema.optional()
  )
}

/**
 * A phone number in E.164 form, e.g. +919876543210.
 *
 * Numbers were previously required to be Indian. The UI now has a country
 * selector, so any country is accepted — but +91 numbers are still held to the
 * Indian mobile rule, since a wrong one there is far more likely to be a typo
 * than a foreign number.
 */
export const phoneNumber = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, 'Enter a valid phone number including the country code')
  .refine(
    (value) => !value.startsWith('+91') || /^\+91[6-9]\d{9}$/.test(value),
    'Enter a valid Indian mobile number (10 digits, starting 6-9)'
  )

import { z } from 'zod'

export const submitVerificationSchema = z.object({
  panNumber: z
    .string()
    .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Invalid PAN format (e.g. ABCDE1234F)')
    .toUpperCase(),
  aadhaarNumber: z
    .string()
    .transform((v) => v.replace(/\s/g, ''))
    .refine((v) => /^\d{12}$/.test(v), 'Aadhaar must be exactly 12 digits'),
})

export type SubmitVerificationDto = z.infer<typeof submitVerificationSchema>
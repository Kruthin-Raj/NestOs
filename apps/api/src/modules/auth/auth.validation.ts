import { z } from 'zod'

export const sendOtpSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Must be a valid email address')
    .max(255, 'Email must be under 255 characters')
    .toLowerCase()
    .trim(),
  role: z.enum(['OWNER', 'TENANT']).optional(),
})

export const verifyOtpSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Must be a valid email address')
    .toLowerCase()
    .trim(),
  otp: z
    .string()
    .min(1, 'OTP is required')
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
  role: z.enum(['OWNER', 'TENANT']).optional(),
})

export type SendOtpDto = z.infer<typeof sendOtpSchema>
export type VerifyOtpDto = z.infer<typeof verifyOtpSchema>
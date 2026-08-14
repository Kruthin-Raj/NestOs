import { z } from 'zod'

const email = z
  .string()
  .min(1, 'Email is required')
  .email('Must be a valid email address')
  .max(255, 'Email must be under 255 characters')
  .toLowerCase()
  .trim()

const otp = z
  .string()
  .min(1, 'OTP is required')
  .length(6, 'OTP must be exactly 6 digits')
  .regex(/^\d{6}$/, 'OTP must contain only digits')

/**
 * Deliberately modest: long enough to matter, not so strict that people write
 * it on a sticky note. Length does the heavy lifting.
 */
const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(72, 'Password must be under 72 characters') // bcrypt truncates past 72
  .regex(/[a-zA-Z]/, 'Password must contain a letter')
  .regex(/\d/, 'Password must contain a number')

export const signupSchema = z.object({
  email,
  password,
  role: z.enum(['OWNER', 'TENANT']),
})

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
})

export const sendOtpSchema = z.object({
  email,
  role: z.enum(['OWNER', 'TENANT']).optional(),
})

export const verifyOtpSchema = z.object({
  email,
  otp,
  role: z.enum(['OWNER', 'TENANT']).optional(),
})

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z.object({
  email,
  otp,
  password,
})

export type SignupDto         = z.infer<typeof signupSchema>
export type LoginDto          = z.infer<typeof loginSchema>
export type SendOtpDto        = z.infer<typeof sendOtpSchema>
export type VerifyOtpDto      = z.infer<typeof verifyOtpSchema>
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordDto  = z.infer<typeof resetPasswordSchema>

import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { validate } from '@middleware/validate.middleware'
import { otpRateLimit } from '@middleware/rate-limit.middleware'
import { sendOtpSchema, verifyOtpSchema } from './auth.validation'
import { sendOtp, verifyOtp, logout, getMe } from './auth.controller'

export const authRouter: ReturnType<typeof Router> = Router()

// POST /api/v1/auth/send-otp
authRouter.post(
  '/send-otp',
  otpRateLimit,
  validate(sendOtpSchema),
  sendOtp
)

// POST /api/v1/auth/verify-otp
authRouter.post(
  '/verify-otp',
  validate(verifyOtpSchema),
  verifyOtp
)

// POST /api/v1/auth/logout
authRouter.post(
  '/logout',
  authenticate,
  logout
)

// GET /api/v1/auth/me
authRouter.get(
  '/me',
  authenticate,
  getMe
)

// POST /api/v1/auth/refresh-token
// TODO: implement in Phase 8
authRouter.post('/refresh-token', (_req, res) => {
  res.status(501).json({
    success: false,
    message: 'Not implemented yet',
    error: { code: 'NOT_IMPLEMENTED' }
  })
})
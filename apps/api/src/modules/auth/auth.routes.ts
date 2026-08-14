import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { validate } from '@middleware/validate.middleware'
import { otpRateLimit } from '@middleware/rate-limit.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendError } from '@utils/response.util'
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  clearTokenCookieOptions,
} from '@utils/jwt.util'
import { JWT } from '@config/constants'
import { sendOtpSchema, verifyOtpSchema } from './auth.validation'
import {
  sendOtpService,
  verifyOtpService,
  getCurrentUserService,
} from './auth.service'

export const authRouter: ReturnType<typeof Router> = Router()

// POST /api/v1/auth/send-otp
authRouter.post('/send-otp',
  otpRateLimit,
  validate(sendOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await sendOtpService(req.body)
    sendSuccess(res, 'OTP sent to your email', result)
  })
)

// POST /api/v1/auth/verify-otp
authRouter.post('/verify-otp',
  validate(verifyOtpSchema),
  asyncHandler(async (req, res) => {
    const result = await verifyOtpService(req.body)

    res.cookie(JWT.ACCESS_COOKIE_NAME, result.accessToken, getAccessTokenCookieOptions())
    res.cookie(JWT.REFRESH_COOKIE_NAME, result.refreshToken, getRefreshTokenCookieOptions())

    sendSuccess(res, 'Login successful', {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    })
  })
)

// POST /api/v1/auth/logout
authRouter.post('/logout',
  authenticate,
  asyncHandler(async (_req, res) => {
    res.clearCookie(JWT.ACCESS_COOKIE_NAME, clearTokenCookieOptions())
    res.clearCookie(JWT.REFRESH_COOKIE_NAME, clearTokenCookieOptions())
    sendSuccess(res, 'Logged out successfully', null)
  })
)

// GET /api/v1/auth/me
authRouter.get('/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await getCurrentUserService(req.user!.userId)
    sendSuccess(res, 'User fetched', user)
  })
)

// POST /api/v1/auth/refresh-token
// STILL NOT IMPLEMENTED. The web client's axios interceptor calls this on any
// 401 and treats a failure as "session over", so today every expired access
// token logs the user out instead of refreshing silently.
authRouter.post('/refresh-token', (_req, res) => {
  sendError(res, 'Not implemented yet', 501, 'NOT_IMPLEMENTED')
})

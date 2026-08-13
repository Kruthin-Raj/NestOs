import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { validate } from '@middleware/validate.middleware'
import { otpRateLimit } from '@middleware/rate-limit.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess } from '@utils/response.util'
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  clearTokenCookieOptions,
  clearRefreshTokenCookieOptions,
} from '@utils/jwt.util'
import { JWT } from '@config/constants'
import { sendOtpSchema, verifyOtpSchema } from './auth.validation'
import {
  sendOtpService,
  verifyOtpService,
  getCurrentUserService,
  refreshTokensService,
  logoutService,
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
  asyncHandler(async (req, res) => {
    // Revoke server-side first: clearing the cookie alone left the refresh
    // token usable for its full 7-day lifetime.
    await logoutService(req.cookies?.[JWT.REFRESH_COOKIE_NAME])

    res.clearCookie(JWT.ACCESS_COOKIE_NAME, clearTokenCookieOptions())
    res.clearCookie(JWT.REFRESH_COOKIE_NAME, clearRefreshTokenCookieOptions())
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
// Called by the web client's axios interceptor on any 401. Rotates the refresh
// token (single-use) and issues a fresh access token. Deliberately not behind
// `authenticate` — the whole point is that the access token has expired.
authRouter.post('/refresh-token',
  asyncHandler(async (req, res) => {
    const result = await refreshTokensService(req.cookies?.[JWT.REFRESH_COOKIE_NAME])

    res.cookie(JWT.ACCESS_COOKIE_NAME, result.accessToken, getAccessTokenCookieOptions())
    res.cookie(JWT.REFRESH_COOKIE_NAME, result.refreshToken, getRefreshTokenCookieOptions())

    sendSuccess(res, 'Session refreshed', {
      user:        result.user,
      accessToken: result.accessToken,
      expiresIn:   result.expiresIn,
    })
  })
)

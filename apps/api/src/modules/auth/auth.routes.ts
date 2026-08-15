import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { validate } from '@middleware/validate.middleware'
import { otpRateLimit, strictRateLimit } from '@middleware/rate-limit.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated } from '@utils/response.util'
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  clearTokenCookieOptions,
  clearRefreshTokenCookieOptions,
} from '@utils/jwt.util'
import { JWT } from '@config/constants'
import {
  sendOtpSchema, verifyOtpSchema, signupSchema, loginSchema,
  forgotPasswordSchema, resetPasswordSchema,
} from './auth.validation'
import {
  sendOtpService,
  verifyOtpService,
  getCurrentUserService,
  refreshTokensService,
  logoutService,
  signupService,
  loginService,
  forgotPasswordService,
  resetPasswordService,
} from './auth.service'

export const authRouter: ReturnType<typeof Router> = Router()

/** Sets the auth cookies for a freshly issued session. */
function setSessionCookies(
  res: import('express').Response,
  tokens: { accessToken: string; refreshToken: string }
) {
  res.cookie(JWT.ACCESS_COOKIE_NAME, tokens.accessToken, getAccessTokenCookieOptions())
  res.cookie(JWT.REFRESH_COOKIE_NAME, tokens.refreshToken, getRefreshTokenCookieOptions())
}

// POST /api/v1/auth/signup
// Creates the account with a password and emails a code to confirm the address.
authRouter.post('/signup',
  otpRateLimit,
  validate(signupSchema),
  asyncHandler(async (req, res) => {
    const result = await signupService(req.body)
    sendCreated(res, 'Account created. Enter the code we emailed you.', result)
  })
)

// POST /api/v1/auth/login — email + password, no OTP.
authRouter.post('/login',
  strictRateLimit,
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const result = await loginService(req.body)
    setSessionCookies(res, result)
    sendSuccess(res, 'Login successful', {
      user:        result.user,
      accessToken: result.accessToken,
      expiresIn:   result.expiresIn,
    })
  })
)

// POST /api/v1/auth/forgot-password
// Always reports success, so it cannot be used to discover registered emails.
authRouter.post('/forgot-password',
  otpRateLimit,
  validate(forgotPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await forgotPasswordService(req.body)
    sendSuccess(res, 'If that email is registered, a reset code is on its way.', result)
  })
)

// POST /api/v1/auth/reset-password
// Also the way an account created before password login sets its first one.
authRouter.post('/reset-password',
  strictRateLimit,
  validate(resetPasswordSchema),
  asyncHandler(async (req, res) => {
    const result = await resetPasswordService(req.body)
    setSessionCookies(res, result)
    sendSuccess(res, 'Password updated', {
      user:        result.user,
      accessToken: result.accessToken,
      expiresIn:   result.expiresIn,
    })
  })
)

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

    setSessionCookies(res, result)

    sendSuccess(res, 'Email verified', {
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

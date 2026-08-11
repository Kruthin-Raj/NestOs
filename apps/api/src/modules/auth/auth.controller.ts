import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess } from '@utils/response.util'
import {
  getAccessTokenCookieOptions,
  getRefreshTokenCookieOptions,
  clearTokenCookieOptions,
} from '@utils/jwt.util'
import { JWT } from '@config/constants'
import {
  sendOtpService,
  verifyOtpService,
  getCurrentUserService,
} from './auth.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
}

export async function sendOtp(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const result = await sendOtpService(req.body)
    sendSuccess(res, 'OTP sent to your email', result)
  } catch (err) {
    next(err)
  }
}

export async function verifyOtp(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const result = await verifyOtpService(req.body)

    res.cookie(JWT.ACCESS_COOKIE_NAME, result.accessToken, getAccessTokenCookieOptions())
    res.cookie(JWT.REFRESH_COOKIE_NAME, result.refreshToken, getRefreshTokenCookieOptions())

    sendSuccess(res, 'Login successful', {
      user: result.user,
      accessToken: result.accessToken,
      expiresIn: result.expiresIn,
    })
  } catch (err) {
    next(err)
  }
}

export async function logout(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    res.clearCookie(JWT.ACCESS_COOKIE_NAME, clearTokenCookieOptions())
    res.clearCookie(JWT.REFRESH_COOKIE_NAME, clearTokenCookieOptions())
    sendSuccess(res, 'Logged out successfully', null)
  } catch (err) {
    next(err)
  }
}

export async function getMe(
  req: Request, res: Response, next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest
    const user = await getCurrentUserService(authReq.user!.userId)
    sendSuccess(res, 'User fetched', user)
  } catch (err) {
    next(err)
  }
}
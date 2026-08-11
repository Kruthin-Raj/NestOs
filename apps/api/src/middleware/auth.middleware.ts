import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { JWT } from '@config/constants'
import { verifyAccessToken } from '@utils/jwt.util'
import { UnauthorizedError } from '@utils/errors'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authReq = req as AuthenticatedRequest

    let token = req.cookies?.[JWT.ACCESS_COOKIE_NAME]

    if (!token) {
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }

    if (!token) {
      throw new UnauthorizedError('Authentication required. Please log in.', 'NO_TOKEN')
    }

    const payload = verifyAccessToken(token)

    authReq.user = {
      userId: payload.userId,
      role: payload.role,
      email: payload.email,
    }

    next()
  } catch (err) {
    next(err)
  }
}

export function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  try {
    const authReq = req as AuthenticatedRequest
    const token = req.cookies?.[JWT.ACCESS_COOKIE_NAME]

    if (token) {
      const payload = verifyAccessToken(token)
      authReq.user = {
        userId: payload.userId,
        role: payload.role,
        email: payload.email,
      }
    }
  } catch {
    // Silently ignore invalid tokens on optional auth routes
  }
  next()
}
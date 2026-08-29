import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { JWT } from '@config/constants'
import { verifyAccessToken } from '@utils/jwt.util'
import { UnauthorizedError, ForbiddenError } from '@utils/errors'
import { prisma } from '@config/prisma'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
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

    // Verify user status in database for immediate lockout & tokenVersion validation
    const user = await prisma.user.findUnique({
      where: { id: payload.userId, deletedAt: null },
      select: { id: true, role: true, email: true, status: true, tokenVersion: true },
    })

    if (!user) {
      throw new UnauthorizedError('Account not found or has been removed.', 'USER_NOT_FOUND')
    }

    if (user.status === 'BLOCKED') {
      throw new ForbiddenError('Your account has been blocked by an administrator.', 'ACCOUNT_BLOCKED')
    }

    if (user.status === 'SUSPENDED') {
      throw new ForbiddenError('Your account is currently suspended.', 'ACCOUNT_SUSPENDED')
    }

    if (user.status === 'DEACTIVATED') {
      throw new ForbiddenError('This account has been deactivated.', 'ACCOUNT_DEACTIVATED')
    }

    if (payload.tokenVersion !== undefined && payload.tokenVersion < user.tokenVersion) {
      throw new UnauthorizedError('Session expired or revoked. Please log in again.', 'SESSION_REVOKED')
    }

    authReq.user = {
      userId: user.id,
      role: user.role,
      email: user.email,
    }

    next()
  } catch (err) {
    next(err)
  }
}

export async function optionalAuth(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authReq = req as AuthenticatedRequest
    let token = req.cookies?.[JWT.ACCESS_COOKIE_NAME]

    if (!token) {
      const authHeader = req.headers.authorization
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7)
      }
    }

    if (token) {
      const payload = verifyAccessToken(token)
      const user = await prisma.user.findUnique({
        where: { id: payload.userId, status: 'ACTIVE', deletedAt: null },
        select: { id: true, role: true, email: true },
      })
      if (user) {
        authReq.user = {
          userId: user.id,
          role: user.role,
          email: user.email,
        }
      }
    }
  } catch {
    // Silently ignore invalid tokens on optional auth routes
  }
  next()
}



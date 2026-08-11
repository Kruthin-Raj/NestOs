import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { ForbiddenError, UnauthorizedError } from '@utils/errors'
import { prisma } from '@config/prisma'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authReq = req as AuthenticatedRequest

    if (!authReq.user) {
      return next(new UnauthorizedError())
    }

    if (!roles.includes(authReq.user.role)) {
      return next(
        new ForbiddenError(
          `This action requires one of these roles: ${roles.join(', ')}`
        )
      )
    }

    next()
  }
}

export const isOwner = requireRole(UserRole.OWNER)
export const isTenant = requireRole(UserRole.TENANT)
export const isAdmin = requireRole(UserRole.SUPER_ADMIN)
export const isOwnerOrAdmin = requireRole(UserRole.OWNER, UserRole.SUPER_ADMIN)

export function requireVerifiedOwner(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest

  if (!authReq.user) {
    return next(new UnauthorizedError())
  }

  if (authReq.user.role !== UserRole.OWNER) {
    return next(new ForbiddenError('Owner account required'))
  }

  prisma.ownerProfile
    .findUnique({
      where: { userId: authReq.user.userId },
      select: { id: true, verificationStatus: true },
    })
    .then((profile) => {
      if (!profile) {
        return next(new ForbiddenError('Owner profile not found'))
      }

      if (profile.verificationStatus !== 'VERIFIED') {
        return next(
          new ForbiddenError(
            'Your account must be verified before accessing this feature.',
            'OWNER_NOT_VERIFIED'
          )
        )
      }

      authReq.resourceOwnerId = profile.id
      next()
    })
    .catch(next)
}

export function requireOwnerAny(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  const authReq = req as AuthenticatedRequest

  if (!authReq.user) {
    return next(new UnauthorizedError())
  }

  if (authReq.user.role !== UserRole.OWNER) {
    return next(new ForbiddenError('Owner account required'))
  }

  prisma.ownerProfile
    .findUnique({
      where: { userId: authReq.user.userId },
      select: { id: true },
    })
    .then((profile) => {
      if (!profile) {
        return next(new ForbiddenError('Owner profile not found. Complete your signup first.'))
      }

      authReq.resourceOwnerId = profile.id
      next()
    })
    .catch(next)
}
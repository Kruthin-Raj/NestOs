import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import {
  updateOwnerProfileSchema,
  updateTenantProfileSchema,
  updatePreferencesSchema,
} from './users.validation'
import { getProfile, updateProfile, updatePreferences } from './users.controller'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: 'SUPER_ADMIN' | 'OWNER' | 'TENANT'
    email: string
  }
}

export const usersRouter: ReturnType<typeof Router> = Router()
usersRouter.get('/profile', authenticate, getProfile)

usersRouter.patch(
  '/profile',
  authenticate,
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const schema =
      req.user?.role === 'OWNER'
        ? updateOwnerProfileSchema
        : updateTenantProfileSchema

    validate(schema)(req, res, next)
  },
  updateProfile
)

usersRouter.patch(
  '/preferences',
  authenticate,
  isTenant,
  validate(updatePreferencesSchema),
  updatePreferences
)
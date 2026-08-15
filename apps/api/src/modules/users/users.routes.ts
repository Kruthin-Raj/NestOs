import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess } from '@utils/response.util'
import {
  updateOwnerProfileSchema,
  updateTenantProfileSchema,
  updatePreferencesSchema,
} from './users.validation'
import {
  getFullProfileService,
  updateOwnerProfileService,
  updateTenantProfileService,
  updatePreferencesService,
} from './users.service'

export const usersRouter: ReturnType<typeof Router> = Router()

usersRouter.get('/profile',
  authenticate,
  asyncHandler(async (req, res) => {
    const result = await getFullProfileService(req.user!.userId, req.user!.role)
    sendSuccess(res, 'Profile fetched', result)
  })
)

usersRouter.patch('/profile',
  authenticate,
  // The body schema depends on the caller's role, so it is picked per request.
  (req: Request, res: Response, next: NextFunction) => {
    const schema =
      req.user?.role === 'OWNER'
        ? updateOwnerProfileSchema
        : updateTenantProfileSchema

    validate(schema)(req, res, next)
  },
  asyncHandler(async (req, res) => {
    const { userId, role } = req.user!

    const result =
      role === 'OWNER'
        ? await updateOwnerProfileService(userId, req.body)
        : await updateTenantProfileService(userId, req.body)

    sendSuccess(res, 'Profile updated', result)
  })
)

usersRouter.patch('/preferences',
  authenticate,
  isTenant,
  validate(updatePreferencesSchema),
  asyncHandler(async (req, res) => {
    const result = await updatePreferencesService(req.user!.userId, req.body)
    sendSuccess(res, 'Preferences updated', result)
  })
)

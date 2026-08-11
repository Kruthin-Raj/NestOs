import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isAdmin } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { getPendingOwners, approveOwner, rejectOwner } from './admin.controller'

export const adminRouter: ReturnType<typeof Router> = Router()
adminRouter.use(authenticate, isAdmin)

adminRouter.get('/owners/pending', getPendingOwners)
adminRouter.post('/owners/:ownerProfileId/approve',
  validate(z.object({ notes: z.string().max(500).optional() })),
  approveOwner
)
adminRouter.post('/owners/:ownerProfileId/reject',
  validate(z.object({ reason: z.string().min(10).max(500) })),
  rejectOwner
)
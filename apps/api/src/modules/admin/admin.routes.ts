import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isAdmin } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess } from '@utils/response.util'
import {
  getPendingOwnersService,
  approveOwnerService,
  rejectOwnerService,
} from './admin.service'

type OwnerProfileParams = { ownerProfileId: string }

export const adminRouter: ReturnType<typeof Router> = Router()
adminRouter.use(authenticate, isAdmin)

adminRouter.get('/owners/pending',
  asyncHandler(async (_req, res) => {
    const result = await getPendingOwnersService()
    sendSuccess(res, 'Pending owners fetched', result)
  })
)

adminRouter.post('/owners/:ownerProfileId/approve',
  validate(z.object({ notes: z.string().max(500).optional() })),
  asyncHandler<OwnerProfileParams>(async (req, res) => {
    const result = await approveOwnerService(
      req.params.ownerProfileId,
      req.user!.userId,
      req.body.notes
    )
    sendSuccess(res, 'Owner approved', result)
  })
)

adminRouter.post('/owners/:ownerProfileId/reject',
  validate(z.object({ reason: z.string().min(10).max(500) })),
  asyncHandler<OwnerProfileParams>(async (req, res) => {
    const result = await rejectOwnerService(
      req.params.ownerProfileId,
      req.user!.userId,
      req.body.reason
    )
    sendSuccess(res, 'Owner rejected', result)
  })
)

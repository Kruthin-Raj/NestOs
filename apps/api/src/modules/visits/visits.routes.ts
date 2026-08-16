import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated } from '@utils/response.util'
import {
  requestVisitService,
  getMyVisitsService,
  getOwnerVisitsService,
  respondToVisitService,
  cancelVisitService,
} from './visits.service'

type VisitParams = { visitId: string }

// ── Tenant ───────────────────────────────────────────────────
export const tenantVisitsRouter: ReturnType<typeof Router> = Router()
tenantVisitsRouter.use(authenticate, isTenant)

tenantVisitsRouter.get('/',
  asyncHandler(async (req, res) => {
    const result = await getMyVisitsService(req.user!.userId)
    sendSuccess(res, 'Visits fetched', result)
  })
)

tenantVisitsRouter.post('/',
  validate(z.object({
    buildingId:  z.string().uuid(),
    requestedAt: z.string().min(1),
    tenantNote:  z.string().max(500).optional(),
  })),
  asyncHandler(async (req, res) => {
    const result = await requestVisitService(req.user!.userId, req.body)
    sendCreated(res, 'Visit requested', result)
  })
)

tenantVisitsRouter.post('/:visitId/cancel',
  asyncHandler<VisitParams>(async (req, res) => {
    const result = await cancelVisitService(req.params.visitId, req.user!.userId, 'TENANT')
    sendSuccess(res, 'Visit cancelled', result)
  })
)

// ── Owner ────────────────────────────────────────────────────
export const ownerVisitsRouter: ReturnType<typeof Router> = Router()
ownerVisitsRouter.use(authenticate, requireVerifiedOwner)

ownerVisitsRouter.get('/',
  asyncHandler(async (req, res) => {
    const result = await getOwnerVisitsService(req.resourceOwnerId!)
    sendSuccess(res, 'Visits fetched', result)
  })
)

// Confirming may move the slot, so confirmedAt is optional and defaults to the
// time the tenant asked for.
ownerVisitsRouter.post('/:visitId/respond',
  validate(z.object({
    action:      z.enum(['CONFIRM', 'DECLINE']),
    confirmedAt: z.string().optional(),
    ownerNote:   z.string().max(500).optional(),
  })),
  asyncHandler<VisitParams>(async (req, res) => {
    const result = await respondToVisitService(
      req.params.visitId,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, `Visit ${result.status.toLowerCase()}`, result)
  })
)

ownerVisitsRouter.post('/:visitId/cancel',
  asyncHandler<VisitParams>(async (req, res) => {
    const result = await cancelVisitService(req.params.visitId, req.user!.userId, 'OWNER')
    sendSuccess(res, 'Visit cancelled', result)
  })
)

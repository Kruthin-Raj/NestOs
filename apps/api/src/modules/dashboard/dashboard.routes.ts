import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess } from '@utils/response.util'
import {
  getOwnerDashboardService,
  getTenantDashboardService,
} from './dashboard.service'

// NOTE: app.ts mounts this router at BOTH /owner/dashboard and /tenant/dashboard,
// so each path below appears under both prefixes. Each route carries its own role
// guard. Paths are unchanged from before the refactor.
export const dashboardRouter: ReturnType<typeof Router> = Router()

dashboardRouter.get('/owner',
  authenticate,
  requireVerifiedOwner,
  asyncHandler(async (req, res) => {
    const result = await getOwnerDashboardService(req.resourceOwnerId!)
    sendSuccess(res, 'Owner dashboard fetched', result)
  })
)

dashboardRouter.get('/tenant',
  authenticate,
  isTenant,
  asyncHandler(async (req, res) => {
    const result = await getTenantDashboardService(req.user!.userId)
    sendSuccess(res, 'Tenant dashboard fetched', result)
  })
)

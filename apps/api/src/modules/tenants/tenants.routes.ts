import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess } from '@utils/response.util'
import {
  getOwnerTenantsService,
  getTenantDetailService,
  updateTenantNotesService,
} from './tenants.service'

type TenantParams = { tenantId: string }

export const tenantsRouter: ReturnType<typeof Router> = Router()
tenantsRouter.use(authenticate, requireVerifiedOwner)

tenantsRouter.get('/tenants',
  asyncHandler(async (req, res) => {
    const result = await getOwnerTenantsService(req.resourceOwnerId!, req.query)
    sendSuccess(res, 'Tenants fetched', result)
  })
)

tenantsRouter.get('/tenants/:tenantId',
  asyncHandler<TenantParams>(async (req, res) => {
    const result = await getTenantDetailService(
      req.params.tenantId,
      req.resourceOwnerId!
    )
    sendSuccess(res, 'Tenant profile fetched', result)
  })
)

tenantsRouter.patch('/tenants/:tenantId/notes',
  validate(z.object({ notes: z.string().max(2000) })),
  asyncHandler<TenantParams>(async (req, res) => {
    const result = await updateTenantNotesService(
      req.params.tenantId,
      req.resourceOwnerId!,
      req.body.notes
    )
    sendSuccess(res, 'Notes updated', result)
  })
)

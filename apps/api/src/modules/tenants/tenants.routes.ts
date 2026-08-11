import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { getOwnerTenants, getTenantDetail, updateTenantNotes } from './tenants.controller'

export const tenantsRouter: ReturnType<typeof Router> = Router()
tenantsRouter.use(authenticate, requireVerifiedOwner)

tenantsRouter.get('/tenants', getOwnerTenants)
tenantsRouter.get('/tenants/:tenantId', getTenantDetail)
tenantsRouter.patch('/tenants/:tenantId/notes',
  validate(z.object({ notes: z.string().max(2000) })),
  updateTenantNotes
)
import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { getOwnerDashboard, getTenantDashboard } from './dashboard.controller'

export const dashboardRouter: ReturnType<typeof Router> = Router()

dashboardRouter.get('/owner',  authenticate, requireVerifiedOwner, getOwnerDashboard)
dashboardRouter.get('/tenant', authenticate, isTenant,             getTenantDashboard)
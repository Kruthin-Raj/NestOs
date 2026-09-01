import { Router, Request, Response } from 'express'
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
  getPendingTenantsService,
  verifyTenantIdService,
  rejectTenantIdService,
  listUsersService,
  getUserDetailService,
  updateUserStatusService,
  updateUserRoleService,
  deleteUserService,
  getAdminIssuesService,
} from './admin.service'
import {
  listUsersQuerySchema,
  updateUserStatusSchema,
  updateUserRoleSchema,
} from './admin.validation'

type OwnerProfileParams  = { ownerProfileId: string }
type TenantProfileParams = { tenantProfileId: string }
type UserParams          = { userId: string }

export const adminRouter: ReturnType<typeof Router> = Router()
adminRouter.use(authenticate, isAdmin)

// ── Verification Queues ──────────────────────────────────────

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

adminRouter.get('/tenants/pending',
  asyncHandler(async (_req, res) => {
    const result = await getPendingTenantsService()
    sendSuccess(res, 'Pending tenants fetched', result)
  })
)

adminRouter.post('/tenants/:tenantProfileId/verify-id',
  validate(z.object({ notes: z.string().max(500).optional() })),
  asyncHandler<TenantProfileParams>(async (req, res) => {
    const result = await verifyTenantIdService(
      req.params.tenantProfileId,
      req.user!.userId,
      req.body.notes
    )
    sendSuccess(res, 'Tenant identity verified', result)
  })
)

adminRouter.post('/tenants/:tenantProfileId/reject-id',
  validate(z.object({ reason: z.string().min(10).max(500) })),
  asyncHandler<TenantProfileParams>(async (req, res) => {
    const result = await rejectTenantIdService(
      req.params.tenantProfileId,
      req.user!.userId,
      req.body.reason
    )
    sendSuccess(res, 'Tenant identity rejected', result)
  })
)

// ── User Management Endpoints ────────────────────────────────

adminRouter.get('/users',
  asyncHandler(async (req: Request, res: Response) => {
    const validatedQuery = listUsersQuerySchema.parse(req.query)
    const result = await listUsersService(validatedQuery)
    sendSuccess(res, 'Users retrieved successfully', result)
  })
)

adminRouter.get('/users/:userId',
  asyncHandler<UserParams>(async (req, res) => {
    const result = await getUserDetailService(req.params.userId)
    sendSuccess(res, 'User details retrieved', result)
  })
)

adminRouter.patch('/users/:userId/status',
  validate(updateUserStatusSchema),
  asyncHandler<UserParams>(async (req, res) => {
    const result = await updateUserStatusService(
      req.params.userId,
      req.user!.userId,
      req.body
    )
    sendSuccess(res, 'User status updated', result)
  })
)

adminRouter.patch('/users/:userId/role',
  validate(updateUserRoleSchema),
  asyncHandler<UserParams>(async (req, res) => {
    const result = await updateUserRoleService(
      req.params.userId,
      req.user!.userId,
      req.body
    )
    sendSuccess(res, 'User role updated', result)
  })
)

adminRouter.delete('/users/:userId',
  asyncHandler<UserParams>(async (req, res) => {
    const result = await deleteUserService(req.params.userId, req.user!.userId)
    sendSuccess(res, 'User deleted successfully', result)
  })
)

// ── Issues ───────────────────────────────────────────────────

adminRouter.get('/issues',
  asyncHandler(async (_req, res) => {
    const result = await getAdminIssuesService()
    sendSuccess(res, 'Issues fetched', result)
  })
)

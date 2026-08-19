import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated, sendNoContent } from '@utils/response.util'
import {
  createNoticeService,
  getOwnerNoticesService,
  deleteNoticeService,
  getTenantNoticesService,
  markNoticeReadService,
  markAllNoticesReadService,
} from './notices.service'

const createNoticeSchema = z.object({
  title:            z.string().min(5).max(255).trim(),
  body:             z.string().min(10).max(5000).trim(),
  category:         z.enum(['MAINTENANCE','SECURITY','RENT_REMINDER','VISITOR','DELIVERY','RULE_REMINDER','GENERAL']),
  targetType:       z.enum(['ALL_BUILDINGS','BUILDING','FLOOR','ROOM','TENANT']),
  targetBuildingId: z.string().uuid().optional(),
  targetFloorId:    z.string().uuid().optional(),
  targetRoomId:     z.string().uuid().optional(),
  targetTenantId:   z.string().uuid().optional(),
  publishAt:        z.string().optional(),
  expiresAt:        z.string().optional(),
  sendEmail:        z.boolean().optional(),
})
  // Every target type except ALL_BUILDINGS needs the id of the thing it points
  // at. Without this the API accepted targetType: 'BUILDING' with no building,
  // stored a notice that matches no tenant's scope, and reported success — the
  // owner saw "Notice published" for something nobody would ever receive.
  .superRefine((dto, ctx) => {
    const required = {
      BUILDING: 'targetBuildingId',
      FLOOR:    'targetFloorId',
      ROOM:     'targetRoomId',
      TENANT:   'targetTenantId',
    } as const

    const field = required[dto.targetType as keyof typeof required]
    if (field && !dto[field]) {
      ctx.addIssue({
        code:    z.ZodIssueCode.custom,
        path:    [field],
        message: `Choose which ${dto.targetType.toLowerCase()} this notice is for`,
      })
    }
  })

type NoticeParams = { noticeId: string }

// ─────────────────────────────────────────────────────────────
// Two routers, one per role.
//
// Previously a single router held '/owner' and '/tenant' paths and was mounted
// at BOTH /owner/notices and /tenant/notices, so the real URLs came out as
// /owner/notices/owner. The web client calls /owner/notices, so every notices
// request 404'd. Paths are now relative to their mount point.
// ─────────────────────────────────────────────────────────────

export const ownerNoticesRouter: ReturnType<typeof Router> = Router()
ownerNoticesRouter.use(authenticate, requireVerifiedOwner)

// GET /api/v1/owner/notices
ownerNoticesRouter.get('/',
  asyncHandler(async (req, res) => {
    const result = await getOwnerNoticesService(
      req.resourceOwnerId!,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Notices fetched', result)
  })
)

// POST /api/v1/owner/notices
ownerNoticesRouter.post('/',
  validate(createNoticeSchema),
  asyncHandler(async (req, res) => {
    const result = await createNoticeService(req.resourceOwnerId!, req.body)
    sendCreated(res, 'Notice created', result)
  })
)

// DELETE /api/v1/owner/notices/:noticeId
ownerNoticesRouter.delete('/:noticeId',
  asyncHandler<NoticeParams>(async (req, res) => {
    await deleteNoticeService(req.params.noticeId, req.resourceOwnerId!)
    sendNoContent(res)
  })
)

export const tenantNoticesRouter: ReturnType<typeof Router> = Router()
tenantNoticesRouter.use(authenticate, isTenant)

// GET /api/v1/tenant/notices
tenantNoticesRouter.get('/',
  asyncHandler(async (req, res) => {
    const result = await getTenantNoticesService(
      req.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Notices fetched', result)
  })
)

// POST /api/v1/tenant/notices/read-all
// One segment, so it cannot collide with /:noticeId/read below.
tenantNoticesRouter.post('/read-all',
  asyncHandler(async (req, res) => {
    const result = await markAllNoticesReadService(req.user!.userId)
    sendSuccess(res, 'All notices marked as read', result)
  })
)

// POST /api/v1/tenant/notices/:noticeId/read
tenantNoticesRouter.post('/:noticeId/read',
  asyncHandler<NoticeParams>(async (req, res) => {
    const result = await markNoticeReadService(req.params.noticeId, req.user!.userId)
    sendSuccess(res, 'Notice marked as read', result)
  })
)

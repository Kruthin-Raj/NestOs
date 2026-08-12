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

type NoticeParams = { noticeId: string }

// NOTE: app.ts mounts this router at BOTH /owner/notices and /tenant/notices,
// so each path below appears under both prefixes. Every route carries its own
// role guard, so the double mount is not an authorization hole — but the
// resulting URLs are doubled up (e.g. /owner/notices/owner). Paths are kept
// exactly as they were; see the handover notes.
export const noticesRouter: ReturnType<typeof Router> = Router()

// Owner routes
noticesRouter.post('/',
  authenticate,
  requireVerifiedOwner,
  validate(createNoticeSchema),
  asyncHandler(async (req, res) => {
    const result = await createNoticeService(req.resourceOwnerId!, req.body)
    sendCreated(res, 'Notice created', result)
  })
)

noticesRouter.get('/owner',
  authenticate,
  requireVerifiedOwner,
  asyncHandler(async (req, res) => {
    const result = await getOwnerNoticesService(
      req.resourceOwnerId!,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Notices fetched', result)
  })
)

noticesRouter.delete('/owner/:noticeId',
  authenticate,
  requireVerifiedOwner,
  asyncHandler<NoticeParams>(async (req, res) => {
    await deleteNoticeService(req.params.noticeId, req.resourceOwnerId!)
    sendNoContent(res)
  })
)

// Tenant routes
noticesRouter.get('/tenant',
  authenticate,
  isTenant,
  asyncHandler(async (req, res) => {
    const result = await getTenantNoticesService(
      req.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Notices fetched', result)
  })
)

noticesRouter.post('/tenant/:noticeId/read',
  authenticate,
  isTenant,
  asyncHandler<NoticeParams>(async (req, res) => {
    const result = await markNoticeReadService(req.params.noticeId, req.user!.userId)
    sendSuccess(res, 'Notice marked as read', result)
  })
)

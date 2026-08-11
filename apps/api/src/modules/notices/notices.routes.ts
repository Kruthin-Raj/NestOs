import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { createNotice, getOwnerNotices, deleteNotice, getTenantNotices, markNoticeRead } from './notices.controller'

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

export const noticesRouter: ReturnType<typeof Router> = Router()
// Owner routes
noticesRouter.post('/',            authenticate, requireVerifiedOwner, validate(createNoticeSchema), createNotice)
noticesRouter.get('/owner',        authenticate, requireVerifiedOwner, getOwnerNotices)
noticesRouter.delete('/owner/:noticeId', authenticate, requireVerifiedOwner, deleteNotice)

// Tenant routes
noticesRouter.get('/tenant',        authenticate, isTenant, getTenantNotices)
noticesRouter.post('/tenant/:noticeId/read', authenticate, isTenant, markNoticeRead)
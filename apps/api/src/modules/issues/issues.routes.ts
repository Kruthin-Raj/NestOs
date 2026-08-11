import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import {
  createIssue, getMyIssues, getMyIssueById, addTenantComment, reopenIssue,
  getOwnerIssues, updateIssueStatus, addOwnerComment,
} from './issues.controller'

const commentSchema = z.object({
  body:      z.string().min(5).max(1000).trim(),
  photoUrls: z.array(z.string().url()).max(3).optional(),
})

const createIssueSchema = z.object({
  category:    z.enum(['MAINTENANCE','PLUMBING','ELECTRICAL','CLEANLINESS','SECURITY','WIFI','APPLIANCE','NOISE','OTHER']),
  priority:    z.enum(['LOW','MEDIUM','HIGH','URGENT']),
  title:       z.string().min(10).max(255).trim(),
  description: z.string().min(20).max(2000).trim(),
  photoUrls:   z.array(z.string().url()).max(5).optional(),
})

export const issuesRouter: ReturnType<typeof Router> = Router()
// Tenant routes
issuesRouter.post('/',          authenticate, isTenant, validate(createIssueSchema), createIssue)
issuesRouter.get('/my',         authenticate, isTenant, getMyIssues)
issuesRouter.get('/my/:issueId',authenticate, isTenant, getMyIssueById)
issuesRouter.post('/my/:issueId/comments', authenticate, isTenant, validate(commentSchema), addTenantComment)
issuesRouter.post('/my/:issueId/reopen',
  authenticate, isTenant,
  validate(z.object({ reason: z.string().min(10).max(500).trim() })),
  reopenIssue
)

// Owner routes
issuesRouter.get('/owner',      authenticate, requireVerifiedOwner, getOwnerIssues)
issuesRouter.patch('/owner/:issueId/status',
  authenticate, requireVerifiedOwner,
  validate(z.object({
    status:          z.enum(['IN_PROGRESS','RESOLVED','REJECTED']),
    note:            z.string().max(500).optional(),
    rejectionReason: z.string().min(5).max(500).optional(),
  })),
  updateIssueStatus
)
issuesRouter.post('/owner/:issueId/comments',
  authenticate, requireVerifiedOwner, validate(commentSchema), addOwnerComment
)
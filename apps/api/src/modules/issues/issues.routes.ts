import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated } from '@utils/response.util'
import {
  createIssueService,
  getMyIssuesService,
  getMyIssueByIdService,
  addTenantCommentService,
  reopenIssueService,
  getOwnerIssuesService,
  updateIssueStatusService,
  addOwnerCommentService,
  verifyIssueResolutionService,
} from './issues.service'

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

type IssueParams = { issueId: string }

export const issuesRouter: ReturnType<typeof Router> = Router()

// Tenant routes
issuesRouter.post('/',
  authenticate, isTenant,
  validate(createIssueSchema),
  asyncHandler(async (req, res) => {
    const result = await createIssueService(req.user!.userId, req.body)
    sendCreated(res, 'Issue created', result)
  })
)

issuesRouter.get('/my',
  authenticate, isTenant,
  asyncHandler(async (req, res) => {
    const result = await getMyIssuesService(
      req.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Issues fetched', result)
  })
)

issuesRouter.get('/my/:issueId',
  authenticate, isTenant,
  asyncHandler<IssueParams>(async (req, res) => {
    const result = await getMyIssueByIdService(req.params.issueId, req.user!.userId)
    sendSuccess(res, 'Issue fetched', result)
  })
)

issuesRouter.post('/my/:issueId/comments',
  authenticate, isTenant,
  validate(commentSchema),
  asyncHandler<IssueParams>(async (req, res) => {
    const result = await addTenantCommentService(
      req.params.issueId,
      req.user!.userId,
      req.body
    )
    sendCreated(res, 'Comment added', result)
  })
)

issuesRouter.post('/my/:issueId/reopen',
  authenticate, isTenant,
  validate(z.object({ reason: z.string().min(10).max(500).trim() })),
  asyncHandler<IssueParams>(async (req, res) => {
    const result = await reopenIssueService(
      req.params.issueId,
      req.user!.userId,
      req.body.reason
    )
    sendSuccess(res, 'Issue reopened', result)
  })
)

issuesRouter.post('/my/:issueId/verify-resolution',
  authenticate, isTenant,
  validate(z.object({
    accepted: z.boolean(),
    reason:   z.string().max(500).optional(),
  })),
  asyncHandler<IssueParams>(async (req, res) => {
    const result = await verifyIssueResolutionService(
      req.params.issueId,
      req.user!.userId,
      req.body
    )
    sendSuccess(res, 'Issue resolution verified', result)
  })
)

// Owner routes
issuesRouter.get('/owner',
  authenticate, requireVerifiedOwner,
  asyncHandler(async (req, res) => {
    const result = await getOwnerIssuesService(
      req.resourceOwnerId!,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Issues fetched', result)
  })
)

issuesRouter.patch('/owner/:issueId/status',
  authenticate, requireVerifiedOwner,
  validate(z.object({
    status:          z.enum(['IN_PROGRESS','RESOLVED','REJECTED']),
    note:            z.string().max(500).optional(),
    rejectionReason: z.string().min(5).max(500).optional(),
  })),
  asyncHandler<IssueParams>(async (req, res) => {
    const result = await updateIssueStatusService(
      req.params.issueId,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Issue status updated', result)
  })
)

issuesRouter.post('/owner/:issueId/comments',
  authenticate, requireVerifiedOwner,
  validate(commentSchema),
  asyncHandler<IssueParams>(async (req, res) => {
    const result = await addOwnerCommentService(
      req.params.issueId,
      req.resourceOwnerId!,
      req.body
    )
    sendCreated(res, 'Comment added', result)
  })
)

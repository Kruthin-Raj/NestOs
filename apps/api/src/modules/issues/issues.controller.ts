import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
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
} from './issues.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
  params: {
    issueId?: string
  }
}

export async function createIssue(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await createIssueService(authReq.user!.userId, req.body)
    sendCreated(res, 'Issue created', result)
  } catch (err) {
    next(err)
  }
}

export async function getMyIssues(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getMyIssuesService(
      authReq.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Issues fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function getMyIssueById(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getMyIssueByIdService(
      authReq.params.issueId!,
      authReq.user!.userId
    )
    sendSuccess(res, 'Issue fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function addTenantComment(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await addTenantCommentService(
      authReq.params.issueId!,
      authReq.user!.userId,
      req.body
    )
    sendCreated(res, 'Comment added', result)
  } catch (err) {
    next(err)
  }
}

export async function reopenIssue(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await reopenIssueService(
      authReq.params.issueId!,
      authReq.user!.userId,
      req.body.reason
    )
    sendSuccess(res, 'Issue reopened', result)
  } catch (err) {
    next(err)
  }
}

export async function getOwnerIssues(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getOwnerIssuesService(
      authReq.resourceOwnerId!,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Issues fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function updateIssueStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await updateIssueStatusService(
      authReq.params.issueId!,
      authReq.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Issue status updated', result)
  } catch (err) {
    next(err)
  }
}

export async function addOwnerComment(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await addOwnerCommentService(
      authReq.params.issueId!,
      authReq.resourceOwnerId!,
      req.body
    )
    sendCreated(res, 'Comment added', result)
  } catch (err) {
    next(err)
  }
}
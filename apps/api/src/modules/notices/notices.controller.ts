import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess, sendCreated, sendNoContent } from '@utils/response.util'
import {
  createNoticeService,
  getOwnerNoticesService,
  deleteNoticeService,
  getTenantNoticesService,
  markNoticeReadService,
} from './notices.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
  params: {
    noticeId?: string
  }
}

export async function createNotice(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await createNoticeService(authReq.resourceOwnerId!, req.body)
    sendCreated(res, 'Notice created', result)
  } catch (err) {
    next(err)
  }
}

export async function getOwnerNotices(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getOwnerNoticesService(
      authReq.resourceOwnerId!,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Notices fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function deleteNotice(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    await deleteNoticeService(
      authReq.params.noticeId!,
      authReq.resourceOwnerId!
    )
    sendNoContent(res)
  } catch (err) {
    next(err)
  }
}

export async function getTenantNotices(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getTenantNoticesService(
      authReq.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Notices fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function markNoticeRead(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await markNoticeReadService(
      authReq.params.noticeId!,
      authReq.user!.userId
    )
    sendSuccess(res, 'Notice marked as read', result)
  } catch (err) {
    next(err)
  }
}
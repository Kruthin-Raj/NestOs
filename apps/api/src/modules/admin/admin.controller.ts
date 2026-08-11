import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess } from '@utils/response.util'
import {
  getPendingOwnersService,
  approveOwnerService,
  rejectOwnerService,
} from './admin.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  params: {
    ownerProfileId?: string
  }
}

export async function getPendingOwners(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await getPendingOwnersService()
    sendSuccess(res, 'Pending owners fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function approveOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await approveOwnerService(
      authReq.params.ownerProfileId!,
      authReq.user!.userId,
      req.body.notes
    )
    sendSuccess(res, 'Owner approved', result)
  } catch (err) {
    next(err)
  }
}

export async function rejectOwner(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await rejectOwnerService(
      authReq.params.ownerProfileId!,
      authReq.user!.userId,
      req.body.reason
    )
    sendSuccess(res, 'Owner rejected', result)
  } catch (err) {
    next(err)
  }
}
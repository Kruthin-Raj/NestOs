import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess } from '@utils/response.util'
import {
  getOwnerDashboardService,
  getTenantDashboardService,
} from './dashboard.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
}

export async function getOwnerDashboard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getOwnerDashboardService(authReq.resourceOwnerId!)
    sendSuccess(res, 'Owner dashboard fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function getTenantDashboard(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getTenantDashboardService(authReq.user!.userId)
    sendSuccess(res, 'Tenant dashboard fetched', result)
  } catch (err) {
    next(err)
  }
}
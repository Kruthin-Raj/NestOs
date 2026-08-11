import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess } from '@utils/response.util'
import {
  getOwnerTenantsService,
  getTenantDetailService,
  updateTenantNotesService,
} from './tenants.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
  params: {
    tenantId?: string
  }
}

export async function getOwnerTenants(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getOwnerTenantsService(authReq.resourceOwnerId!, req.query)
    res.json({ success: true, message: 'Tenants fetched', data: result })
  } catch (err) {
    next(err)
  }
}

export async function getTenantDetail(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await getTenantDetailService(authReq.params.tenantId!, authReq.resourceOwnerId!)
    sendSuccess(res, 'Tenant profile fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function updateTenantNotes(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const result = await updateTenantNotesService(
      authReq.params.tenantId!,
      authReq.resourceOwnerId!,
      req.body.notes
    )
    sendSuccess(res, 'Notes updated', result)
  } catch (err) {
    next(err)
  }
}
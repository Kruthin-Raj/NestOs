import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess } from '@utils/response.util'
import {
  getBedsService,
  createBedService,
  updateBedService,
  assignBedService,
  releaseBedService,
} from './beds.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
  params: {
    buildingId?: string
    roomId?: string
    bedId?: string
  }
}

export async function getBeds(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await getBedsService(
      authReq.params.buildingId!,
      authReq.params.roomId!,
      authReq.resourceOwnerId!
    )
    sendSuccess(res, 'Beds fetched', r)
  } catch (err) {
    next(err)
  }
}

export async function createBed(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await createBedService(
      authReq.params.buildingId!,
      authReq.params.roomId!,
      authReq.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Bed created', r, 201)
  } catch (err) {
    next(err)
  }
}

export async function updateBed(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await updateBedService(
      authReq.params.buildingId!,
      authReq.params.roomId!,
      authReq.params.bedId!,
      authReq.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Bed updated', r)
  } catch (err) {
    next(err)
  }
}

export async function assignBed(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await assignBedService(
      authReq.params.buildingId!,
      authReq.params.roomId!,
      authReq.params.bedId!,
      authReq.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Bed assigned', r)
  } catch (err) {
    next(err)
  }
}

export async function releaseBed(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await releaseBedService(
      authReq.params.buildingId!,
      authReq.params.roomId!,
      authReq.params.bedId!,
      authReq.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Bed released', r)
  } catch (err) {
    next(err)
  }
}
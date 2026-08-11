import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess, sendCreated, sendNoContent } from '@utils/response.util'
import {
  getFloorsService,
  createFloorService,
  deleteFloorService,
} from './floors.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
  params: {
    buildingId?: string
    floorId?: string
  } & Request['params']
}

export async function getFloors(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const floors = await getFloorsService(
      req.params.buildingId!,
      req.resourceOwnerId!
    )
    sendSuccess(res, 'Floors fetched', floors)
  } catch (err) {
    next(err)
  }
}

export async function createFloor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const floor = await createFloorService(
      req.params.buildingId!,
      req.resourceOwnerId!,
      req.body
    )
    sendCreated(res, 'Floor created', floor)
  } catch (err) {
    next(err)
  }
}

export async function deleteFloor(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    await deleteFloorService(
      req.params.buildingId!,
      req.params.floorId!,
      req.resourceOwnerId!
    )
    sendNoContent(res)
  } catch (err) {
    next(err)
  }
}
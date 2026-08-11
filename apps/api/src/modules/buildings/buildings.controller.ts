import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess, sendCreated, sendNoContent } from '@utils/response.util'
import {
  getBuildingsService,
  getBuildingService,
  createBuildingService,
  updateBuildingService,
  deleteBuildingService,
  searchPropertiesService,
  getPublicPropertyService,
  updateBuildingStatusService,
} from './buildings.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
  params: {
    buildingId?: string
  } & Request['params']
}

export async function getBuildings(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const ownerId = req.resourceOwnerId!
    const result = await getBuildingsService(ownerId, req.query as Record<string, unknown>)
    sendSuccess(res, 'Buildings fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function getBuilding(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const building = await getBuildingService(
      req.params.buildingId!,
      req.resourceOwnerId!
    )
    sendSuccess(res, 'Building fetched', building)
  } catch (err) {
    next(err)
  }
}

export async function createBuilding(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const building = await createBuildingService(req.resourceOwnerId!, req.body)
    sendCreated(res, 'Building created. Add floors and rooms to make it live.', building)
  } catch (err) {
    next(err)
  }
}

export async function updateBuilding(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await updateBuildingService(
      req.params.buildingId!,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Building updated', result)
  } catch (err) {
    next(err)
  }
}

export async function deleteBuilding(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    await deleteBuildingService(
      req.params.buildingId!,
      req.resourceOwnerId!
    )
    sendNoContent(res)
  } catch (err) {
    next(err)
  }
}

export async function searchProperties(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await searchPropertiesService(req.query as Record<string, unknown>)
    sendSuccess(res, 'Properties found', result)
  } catch (err) {
    next(err)
  }
}

export async function getPublicProperty(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await getPublicPropertyService(
      req.params.buildingId!,
      req.user?.userId
    )
    sendSuccess(res, 'Property details fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function updateBuildingStatus(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await updateBuildingStatusService(
      req.params.buildingId!,
      req.resourceOwnerId!,
      req.body.status
    )
    sendSuccess(res, result.message, { status: result.status })
  } catch (err) {
    next(err)
  }
}
import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess, sendCreated, sendNoContent } from '@utils/response.util'
import {
  getRoomsService,
  createRoomService,
  updateRoomService,
  deleteRoomService,
} from './rooms.service'

type BuildingParams = {
  buildingId?: string
}

type RoomParams = {
  buildingId?: string
  roomId?: string
}

type AuthenticatedRequest<T = Record<string, string | undefined>> = Request<T> & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
}

export async function getRooms(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const authReq = req as AuthenticatedRequest

    const result = await getRoomsService(
      authReq.params.buildingId!,
      authReq.resourceOwnerId!,
      req.query as Record<string, unknown>
    )

    sendSuccess(res, 'Rooms fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function createRoom(
  req: AuthenticatedRequest<BuildingParams>,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await createRoomService(
      req.params.buildingId!,
      req.resourceOwnerId!,
      req.body
    )
    sendCreated(res, 'Room created', result)
  } catch (err) {
    next(err)
  }
}

export async function updateRoom(
  req: AuthenticatedRequest<RoomParams>,
  res: Response,
  next: NextFunction
) {
  try {
    const result = await updateRoomService(
      req.params.buildingId!,
      req.params.roomId!,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Room updated', result)
  } catch (err) {
    next(err)
  }
}

export async function deleteRoom(
  req: AuthenticatedRequest<RoomParams>,
  res: Response,
  next: NextFunction
) {
  try {
    await deleteRoomService(
      req.params.buildingId!,
      req.params.roomId!,
      req.resourceOwnerId!
    )
    sendNoContent(res)
  } catch (err) {
    next(err)
  }
}
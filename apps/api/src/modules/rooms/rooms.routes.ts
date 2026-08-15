import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated, sendNoContent } from '@utils/response.util'
import {
  getRoomsService,
  createRoomService,
  updateRoomService,
  deleteRoomService,
} from './rooms.service'

const createRoomSchema = z.object({
  floorId:     z.string().uuid(),
  roomNumber:  z.string().min(1).max(20).trim(),
  type:        z.enum(['PRIVATE', 'SHARED', 'DORMITORY']),
  capacity:    z.number().int().min(1).max(20),
  // Matches the bed rule (beds.routes.ts) and the form, which labels this
  // "rent per bed". A room floor above its own beds' floor made no sense and
  // silently 422'd anything a dormitory owner tried to enter.
  baseRent:    z.number().positive().min(500),
  description: z.string().max(500).optional(),
  amenities:   z.array(z.string().max(50)).max(10).optional(),
})

type BuildingParams = { buildingId: string }
type RoomParams     = { buildingId: string; roomId: string }

export const roomsRouter: ReturnType<typeof Router> = Router()
roomsRouter.use(authenticate, requireVerifiedOwner)

roomsRouter.get('/:buildingId/rooms',
  asyncHandler<BuildingParams>(async (req, res) => {
    const result = await getRoomsService(
      req.params.buildingId,
      req.resourceOwnerId!,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Rooms fetched', result)
  })
)

roomsRouter.post('/:buildingId/rooms',
  validate(createRoomSchema),
  asyncHandler<BuildingParams>(async (req, res) => {
    const result = await createRoomService(
      req.params.buildingId,
      req.resourceOwnerId!,
      req.body
    )
    sendCreated(res, 'Room created', result)
  })
)

roomsRouter.patch('/:buildingId/rooms/:roomId',
  validate(createRoomSchema.partial()),
  asyncHandler<RoomParams>(async (req, res) => {
    const result = await updateRoomService(
      req.params.buildingId,
      req.params.roomId,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Room updated', result)
  })
)

roomsRouter.delete('/:buildingId/rooms/:roomId',
  asyncHandler<RoomParams>(async (req, res) => {
    await deleteRoomService(
      req.params.buildingId,
      req.params.roomId,
      req.resourceOwnerId!
    )
    sendNoContent(res)
  })
)

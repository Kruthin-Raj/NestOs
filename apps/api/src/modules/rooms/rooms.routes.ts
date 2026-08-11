import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { getRooms, createRoom, updateRoom, deleteRoom } from './rooms.controller'

const createRoomSchema = z.object({
  floorId:     z.string().uuid(),
  roomNumber:  z.string().min(1).max(20).trim(),
  type:        z.enum(['PRIVATE', 'SHARED', 'DORMITORY']),
  capacity:    z.number().int().min(1).max(20),
  baseRent:    z.number().positive().min(1000),
  description: z.string().max(500).optional(),
  amenities:   z.array(z.string().max(50)).max(10).optional(),
})

export const roomsRouter: ReturnType<typeof Router> = Router()
roomsRouter.use(authenticate, requireVerifiedOwner)
roomsRouter.get('/:buildingId/rooms', getRooms)
roomsRouter.post('/:buildingId/rooms', validate(createRoomSchema), createRoom)
roomsRouter.patch('/:buildingId/rooms/:roomId', validate(createRoomSchema.partial()), updateRoom)
roomsRouter.delete('/:buildingId/rooms/:roomId', deleteRoom)
import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { getFloors, createFloor, deleteFloor } from './floors.controller'

export const floorsRouter: ReturnType<typeof Router> = Router()
floorsRouter.use(authenticate, requireVerifiedOwner)

floorsRouter.get('/:buildingId/floors', getFloors)
floorsRouter.post('/:buildingId/floors',
  validate(z.object({
    floorNumber: z.number().int().min(0).max(50),
    label:       z.string().max(50).optional(),
  })),
  createFloor
)
floorsRouter.delete('/:buildingId/floors/:floorId', deleteFloor)
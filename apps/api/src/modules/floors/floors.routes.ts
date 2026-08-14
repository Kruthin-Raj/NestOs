import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { optional } from '@utils/zod.util'
import { sendSuccess, sendCreated, sendNoContent } from '@utils/response.util'
import {
  getFloorsService,
  createFloorService,
  deleteFloorService,
} from './floors.service'

export const floorsRouter: ReturnType<typeof Router> = Router()
floorsRouter.use(authenticate, requireVerifiedOwner)

const createFloorSchema = z.object({
  floorNumber: z.number().int().min(0).max(50),
  // A blank label field posts "", which stored an empty string and then
  // rendered as a nameless floor in the room form. Treat blank as absent so the
  // "Floor <n>" fallback applies.
  label:       optional(z.string().max(50).trim()),
})

floorsRouter.get('/:buildingId/floors',
  asyncHandler<{ buildingId: string }>(async (req, res) => {
    const floors = await getFloorsService(req.params.buildingId, req.resourceOwnerId!)
    sendSuccess(res, 'Floors fetched', floors)
  })
)

floorsRouter.post('/:buildingId/floors',
  validate(createFloorSchema),
  asyncHandler<{ buildingId: string }>(async (req, res) => {
    const floor = await createFloorService(
      req.params.buildingId,
      req.resourceOwnerId!,
      req.body
    )
    sendCreated(res, 'Floor created', floor)
  })
)

floorsRouter.delete('/:buildingId/floors/:floorId',
  asyncHandler<{ buildingId: string; floorId: string }>(async (req, res) => {
    await deleteFloorService(
      req.params.buildingId,
      req.params.floorId,
      req.resourceOwnerId!
    )
    sendNoContent(res)
  })
)

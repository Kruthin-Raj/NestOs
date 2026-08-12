import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess } from '@utils/response.util'
import {
  getBedsService,
  createBedService,
  updateBedService,
  assignBedService,
  releaseBedService,
} from './beds.service'

type RoomParams = { buildingId: string; roomId: string }
type BedParams  = { buildingId: string; roomId: string; bedId: string }

export const bedsRouter: ReturnType<typeof Router> = Router()
bedsRouter.use(authenticate, requireVerifiedOwner)

bedsRouter.get('/:buildingId/rooms/:roomId/beds',
  asyncHandler<RoomParams>(async (req, res) => {
    const r = await getBedsService(
      req.params.buildingId,
      req.params.roomId,
      req.resourceOwnerId!
    )
    sendSuccess(res, 'Beds fetched', r)
  })
)

bedsRouter.post('/:buildingId/rooms/:roomId/beds',
  validate(z.object({
    bedLabel:    z.string().min(1).max(20).trim(),
    monthlyRent: z.number().positive().min(500),
    notes:       z.string().max(500).optional(),
  })),
  asyncHandler<RoomParams>(async (req, res) => {
    const r = await createBedService(
      req.params.buildingId,
      req.params.roomId,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Bed created', r, 201)
  })
)

bedsRouter.patch('/:buildingId/rooms/:roomId/beds/:bedId',
  validate(z.object({
    monthlyRent: z.number().positive().min(500).optional(),
    notes:       z.string().max(500).optional(),
    status:      z.enum(['VACANT', 'BLOCKED']).optional(),
  })),
  asyncHandler<BedParams>(async (req, res) => {
    const r = await updateBedService(
      req.params.buildingId,
      req.params.roomId,
      req.params.bedId,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Bed updated', r)
  })
)

bedsRouter.patch('/:buildingId/rooms/:roomId/beds/:bedId/assign',
  validate(z.object({
    tenantId:      z.string().uuid(),
    moveInDate:    z.string().refine((d) => new Date(d) >= new Date(new Date().setHours(0,0,0,0)), 'Move-in date cannot be in the past'),
    monthlyRent:   z.number().positive(),
    depositAmount: z.number().min(0),
  })),
  asyncHandler<BedParams>(async (req, res) => {
    const r = await assignBedService(
      req.params.buildingId,
      req.params.roomId,
      req.params.bedId,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Bed assigned', r)
  })
)

bedsRouter.post('/:buildingId/rooms/:roomId/beds/:bedId/release',
  validate(z.object({
    actualMoveOutDate: z.string(),
    notes:             z.string().max(500).optional(),
  })),
  asyncHandler<BedParams>(async (req, res) => {
    const r = await releaseBedService(
      req.params.buildingId,
      req.params.roomId,
      req.params.bedId,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Bed released', r)
  })
)

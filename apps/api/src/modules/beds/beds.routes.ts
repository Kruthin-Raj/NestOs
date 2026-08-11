import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { getBeds, createBed, updateBed, assignBed, releaseBed } from './beds.controller'

export const bedsRouter: ReturnType<typeof Router> = Router()
bedsRouter.use(authenticate, requireVerifiedOwner)

bedsRouter.get('/:buildingId/rooms/:roomId/beds', getBeds)

bedsRouter.post('/:buildingId/rooms/:roomId/beds',
  validate(z.object({
    bedLabel:    z.string().min(1).max(20).trim(),
    monthlyRent: z.number().positive().min(500),
    notes:       z.string().max(500).optional(),
  })),
  createBed
)

bedsRouter.patch('/:buildingId/rooms/:roomId/beds/:bedId',
  validate(z.object({
    monthlyRent: z.number().positive().min(500).optional(),
    notes:       z.string().max(500).optional(),
    status:      z.enum(['VACANT', 'BLOCKED']).optional(),
  })),
  updateBed
)

bedsRouter.patch('/:buildingId/rooms/:roomId/beds/:bedId/assign',
  validate(z.object({
    tenantId:      z.string().uuid(),
    moveInDate:    z.string().refine((d) => new Date(d) >= new Date(new Date().setHours(0,0,0,0)), 'Move-in date cannot be in the past'),
    monthlyRent:   z.number().positive(),
    depositAmount: z.number().min(0),
  })),
  assignBed
)

bedsRouter.post('/:buildingId/rooms/:roomId/beds/:bedId/release',
  validate(z.object({
    actualMoveOutDate: z.string(),
    notes:             z.string().max(500).optional(),
  })),
  releaseBed
)
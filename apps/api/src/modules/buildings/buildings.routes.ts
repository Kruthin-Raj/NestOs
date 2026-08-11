import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate, validateQuery } from '@middleware/validate.middleware'
import {
  createBuildingSchema, updateBuildingSchema, getBuildingsQuerySchema
} from './buildings.validation'
import {
  getBuildings, getBuilding, createBuilding,
  updateBuilding, deleteBuilding,
} from './buildings.controller'
import { optionalAuth } from '@middleware/auth.middleware'
import { z } from 'zod'
import { searchProperties, getPublicProperty, updateBuildingStatus } from './buildings.controller'

export const buildingsRouter: ReturnType<typeof Router> = Router()
// All building routes require verified owner
buildingsRouter.use(authenticate, requireVerifiedOwner)

buildingsRouter.get(
  '/',
  validateQuery(getBuildingsQuerySchema),
  getBuildings
)
buildingsRouter.post(
  '/',
  validate(createBuildingSchema),
  createBuilding
)
buildingsRouter.get('/:buildingId', getBuilding)
buildingsRouter.patch(
  '/:buildingId',
  validate(updateBuildingSchema),
  updateBuilding
)
buildingsRouter.delete('/:buildingId', deleteBuilding)
buildingsRouter.get('/search', validateQuery(
  z.object({
    city: z.string().optional(), page: z.string().optional(),
    limit: z.string().optional(), type: z.string().optional(),
    genderPreference: z.string().optional(),
  })
), searchProperties)

buildingsRouter.get('/:buildingId/public', optionalAuth, getPublicProperty)

// Status change — add after existing routes
buildingsRouter.patch(
  '/:buildingId/status',
  authenticate,
  requireVerifiedOwner,
  validate(z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) })),
  updateBuildingStatus
)
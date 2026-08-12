import { Router } from 'express'
import { z } from 'zod'
import { authenticate, optionalAuth } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate, validateQuery } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated, sendNoContent } from '@utils/response.util'
import {
  createBuildingSchema, updateBuildingSchema, getBuildingsQuerySchema
} from './buildings.validation'
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

type BuildingParams = { buildingId: string }

export const buildingsRouter: ReturnType<typeof Router> = Router()

// All building routes require verified owner.
// NOTE: this also covers '/search' and '/:buildingId/public' below, which read
// as intended-public (the latter even adds optionalAuth). Route order and
// middleware are preserved exactly as they were — see the handover notes.
buildingsRouter.use(authenticate, requireVerifiedOwner)

buildingsRouter.get('/',
  validateQuery(getBuildingsQuerySchema),
  asyncHandler(async (req, res) => {
    const ownerId = req.resourceOwnerId!
    const result = await getBuildingsService(ownerId, req.query as Record<string, unknown>)
    sendSuccess(res, 'Buildings fetched', result)
  })
)

buildingsRouter.post('/',
  validate(createBuildingSchema),
  asyncHandler(async (req, res) => {
    const building = await createBuildingService(req.resourceOwnerId!, req.body)
    sendCreated(res, 'Building created. Add floors and rooms to make it live.', building)
  })
)

buildingsRouter.get('/:buildingId',
  asyncHandler<BuildingParams>(async (req, res) => {
    const building = await getBuildingService(
      req.params.buildingId,
      req.resourceOwnerId!
    )
    sendSuccess(res, 'Building fetched', building)
  })
)

buildingsRouter.patch('/:buildingId',
  validate(updateBuildingSchema),
  asyncHandler<BuildingParams>(async (req, res) => {
    const result = await updateBuildingService(
      req.params.buildingId,
      req.resourceOwnerId!,
      req.body
    )
    sendSuccess(res, 'Building updated', result)
  })
)

buildingsRouter.delete('/:buildingId',
  asyncHandler<BuildingParams>(async (req, res) => {
    await deleteBuildingService(req.params.buildingId, req.resourceOwnerId!)
    sendNoContent(res)
  })
)

// NOTE: registered after '/:buildingId', so GET /search is matched by that
// route first and never reaches this handler. Order preserved from before the
// refactor — see the handover notes.
buildingsRouter.get('/search',
  validateQuery(
    z.object({
      city: z.string().optional(), page: z.string().optional(),
      limit: z.string().optional(), type: z.string().optional(),
      genderPreference: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await searchPropertiesService(req.query as Record<string, unknown>)
    sendSuccess(res, 'Properties found', result)
  })
)

buildingsRouter.get('/:buildingId/public',
  optionalAuth,
  asyncHandler<BuildingParams>(async (req, res) => {
    const result = await getPublicPropertyService(
      req.params.buildingId,
      req.user?.userId
    )
    sendSuccess(res, 'Property details fetched', result)
  })
)

// Status change — add after existing routes
buildingsRouter.patch('/:buildingId/status',
  authenticate,
  requireVerifiedOwner,
  validate(z.object({ status: z.enum(['ACTIVE', 'INACTIVE']) })),
  asyncHandler<BuildingParams>(async (req, res) => {
    const result = await updateBuildingStatusService(
      req.params.buildingId,
      req.resourceOwnerId!,
      req.body.status
    )
    sendSuccess(res, result.message, { status: result.status })
  })
)

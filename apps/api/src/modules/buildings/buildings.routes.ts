import { Router } from 'express'
import { z } from 'zod'
import { authenticate, optionalAuth } from '@middleware/auth.middleware'
import { requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate, validateQuery } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { logger } from '@utils/logger'
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

// ─────────────────────────────────────────────────────────────
// Public / tenant-facing routes.
//
// These live on a separate router because buildingsRouter applies
// requireVerifiedOwner to everything it holds — which previously locked
// tenants out of property search and property detail. app.ts mounts this
// router at the same prefix but BEFORE buildingsRouter, so '/search' is
// matched here instead of being swallowed by '/:buildingId'.
// ─────────────────────────────────────────────────────────────
export const publicBuildingsRouter: ReturnType<typeof Router> = Router()

publicBuildingsRouter.get('/search',
  validateQuery(
    z.object({
      city: z.string().optional(), page: z.string().optional(),
      limit: z.string().optional(), type: z.string().optional(),
      genderPreference: z.string().optional(),
      minRent: z.string().optional(), maxRent: z.string().optional(),
      // Supplying both switches on proximity search: results are limited to
      // radiusKm of the point and ordered nearest first.
      lat: z.string().optional(), lng: z.string().optional(),
      radiusKm: z.string().optional(),
    })
  ),
  asyncHandler(async (req, res) => {
    const result = await searchPropertiesService(req.query as Record<string, unknown>)
    sendSuccess(res, 'Properties found', result)
  })
)

// optionalAuth so a logged-in tenant gets personalised data, while an
// anonymous visitor can still view the listing.
publicBuildingsRouter.get('/:buildingId/public',
  optionalAuth,
  asyncHandler<BuildingParams>(async (req, res) => {
    const result = await getPublicPropertyService(
      req.params.buildingId,
      req.user?.userId
    )
    sendSuccess(res, 'Property details fetched', result)
  })
)

// ─────────────────────────────────────────────────────────────
// Owner-only routes — every one requires a VERIFIED owner.
// ─────────────────────────────────────────────────────────────
export const buildingsRouter: ReturnType<typeof Router> = Router()

buildingsRouter.use(authenticate, requireVerifiedOwner)

/**
 * Hosts this endpoint is willing to make a request to.
 *
 * Matched against the parsed hostname, never as a substring of the whole URL:
 * `url.includes('goo.gl')` also matches `http://169.254.169.254/?x=goo.gl`,
 * which would have the server fetch an internal address on a caller's behalf.
 */
const SHORT_LINK_HOSTS = ['maps.app.goo.gl', 'goo.gl', 'g.page']

function isShortLink(raw: string): boolean {
  try {
    const { protocol, hostname } = new URL(raw)
    return (protocol === 'https:' || protocol === 'http:')
      && SHORT_LINK_HOSTS.includes(hostname.toLowerCase())
  } catch {
    return false
  }
}

buildingsRouter.get('/resolve-map-url',
  validateQuery(z.object({ url: z.string().url() })),
  asyncHandler(async (req, res) => {
    const url = req.query.url as string

    const extractCoordinates = (u: string) => {
      const match = u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
      if (match) return { latitude: parseFloat(match[1]), longitude: parseFloat(match[2]) }
      return null
    }

    let coords = extractCoordinates(url)

    if (!coords && isShortLink(url)) {
      try {
        // redirect: 'manual' — we only want the Location header. Following the
        // redirect would hand an attacker a second, unchecked hop.
        const response = await fetch(url, { redirect: 'manual' })
        const location = response.headers.get('location')
        if (location) {
          coords = extractCoordinates(location)
        }
      } catch (err) {
        // A shortener being unreachable is a normal outcome, not a failure of
        // the request — the caller just gets nulls back. Logged rather than
        // swallowed so it is visible when every resolve suddenly stops working.
        logger.warn(`Could not resolve short link: ${(err as Error).message}`, 'Buildings')
      }
    }

    sendSuccess(res, 'Map URL resolved', coords || { latitude: null, longitude: null })
  })
)

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

buildingsRouter.patch('/:buildingId/status',
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

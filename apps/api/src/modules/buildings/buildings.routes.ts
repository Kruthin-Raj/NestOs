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

/**
 * Pulls coordinates out of a Google Maps URL.
 *
 * Google has no single format, and which one you get depends on where the link
 * came from — the desktop address bar, "Share", or the mobile app. Matching only
 * `@lat,lng` silently failed on most of them:
 *
 *   /maps/@12.97,77.59,15z                    the map centre
 *   /maps/place/X/@12.97,77.59,17z            a place, with the centre
 *   ?q=12.97,77.59  /  ?query=12.97,77.59     an explicit point
 *   !3d12.97!4d77.59                          the place's own coordinates
 *   ?ll=12.97,77.59                           older share links
 *
 * Ordered deliberately: !3d/!4d is the place itself, while @ is wherever the
 * viewport happened to be, so the former wins when a URL carries both.
 */
const COORD_PATTERNS = [
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/,
  /[?&](?:q|query|ll|sll|center)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
]

function extractCoordinates(raw: string) {
  // Share links percent-encode the comma, so ?query=12.97%2C77.59 would not
  // match an unescaped pattern.
  let candidate = raw
  try { candidate = decodeURIComponent(raw) } catch { /* leave as-is */ }

  for (const pattern of [...COORD_PATTERNS]) {
    const match = candidate.match(pattern)
    if (!match) continue

    const latitude = parseFloat(match[1])
    const longitude = parseFloat(match[2])

    // A pattern can match something that is not a coordinate at all — Google
    // packs plenty of other numbers into these URLs.
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
      return { latitude, longitude }
    }
  }
  return null
}

/** Where a shortener is allowed to send us. */
const GOOGLE_HOSTS = /(^|\.)(google\.[a-z.]+|goo\.gl|g\.page)$/i

/**
 * Expands a Google short link far enough to read coordinates out of it.
 *
 * Redirects are followed by hand rather than with `redirect: 'follow'` so every
 * hop's host is re-checked — otherwise a redirect could point the server at an
 * internal address, which is the SSRF this endpoint has to avoid. The body is
 * never read; only the Location header.
 */
async function followShortLink(startUrl: string, maxHops = 4) {
  let current = startUrl

  for (let hop = 0; hop < maxHops; hop++) {
    const response = await fetch(current, {
      redirect: 'manual',
      signal:   AbortSignal.timeout(5000),
      // A bare fetch gets a different, coordinate-free response from Google.
      headers:  { 'User-Agent': 'Mozilla/5.0 (compatible; NestOS/1.0)' },
    })

    const location = response.headers.get('location')
    if (!location) return null

    const next = new URL(location, current)
    if (!GOOGLE_HOSTS.test(next.hostname)) {
      logger.warn(`Short link left Google: ${next.hostname}`, 'Buildings')
      return null
    }

    const coords = extractCoordinates(next.toString())
    if (coords) return coords

    current = next.toString()
  }

  return null
}

buildingsRouter.get('/resolve-map-url',
  validateQuery(z.object({ url: z.string().url() })),
  asyncHandler(async (req, res) => {
    const url = req.query.url as string

    let coords = extractCoordinates(url)

    if (!coords && isShortLink(url)) {
      try {
        coords = await followShortLink(url)
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

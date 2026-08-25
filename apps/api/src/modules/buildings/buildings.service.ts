import { prisma } from '@config/prisma'
import { scoreCompatibility } from './compatibility'
import { NotFoundError, BadRequestError } from '@utils/errors'
import { buildPaginationMeta } from '@utils/response.util'
import { parsePagination } from '@utils/pagination.util'

// ─────────────────────────────────────────────────────────────
// Owner: list buildings
// ─────────────────────────────────────────────────────────────
export async function getBuildingsService(
  ownerId: string,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query)

  const status = typeof query.status === 'string' ? query.status : undefined
  const city = typeof query.city === 'string' ? query.city : undefined
  const search = typeof query.search === 'string' ? query.search : undefined

  const where = {
    ownerId,
    deletedAt: null,
    ...(status ? { status: status as never } : {}),
    ...(city
      ? {
          city: {
            contains: city,
            mode: 'insensitive' as const,
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            {
              name: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
            {
              addressLine1: {
                contains: search,
                mode: 'insensitive' as const,
              },
            },
          ],
        }
      : {}),
  }

  const [buildings, total] = await Promise.all([
    prisma.building.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        amenities: {
          select: { name: true },
        },
        photos: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: {
            fileUrl: true,
            caption: true,
            sortOrder: true,
          },
        },
        beds: {
          where: { deletedAt: null },
          select: {
            id: true,
            status: true,
            monthlyRent: true,
          },
        },
      },
    }),
    prisma.building.count({ where }),
  ])

  const items = buildings.map((b) => {
    const totalBeds = b.beds.length
    const occupiedBeds = b.beds.filter((bed) => bed.status === 'OCCUPIED').length

    return {
      ...b,
      totalBeds,
      occupiedBeds,
    }
  })

  return {
    items,
    pagination: buildPaginationMeta(page, limit, total),
  }
}

// ─────────────────────────────────────────────────────────────
// Owner: get one building
// ─────────────────────────────────────────────────────────────
export async function getBuildingService(buildingId: string, ownerId: string) {
  const building = await prisma.building.findFirst({
    where: {
      id: buildingId,
      ownerId,
      deletedAt: null,
    },
    include: {
      amenities: {
        select: { name: true },
      },
      photos: {
        orderBy: { sortOrder: 'asc' },
      },
      floors: {
        where: { deletedAt: null },
        orderBy: { floorNumber: 'asc' },
        include: {
          rooms: {
            where: { deletedAt: null },
            include: {
              beds: {
                where: { deletedAt: null },
                select: {
                  id: true,
                  status: true,
                  monthlyRent: true,
                },
              },
            },
          },
        },
      },
      rooms: {
        where: { deletedAt: null },
        include: {
          amenities: {
            select: { name: true },
          },
          beds: {
            where: { deletedAt: null },
            select: {
              id: true,
              status: true,
              monthlyRent: true,
            },
          },
        },
      },
      beds: {
        where: { deletedAt: null },
        select: {
          id: true,
          status: true,
          monthlyRent: true,
        },
      },
    },
  })

  if (!building) {
    throw new NotFoundError('Building not found')
  }

  const totalBeds = building.beds.length
  const occupiedBeds = building.beds.filter((bed) => bed.status === 'OCCUPIED').length

  return {
    ...building,
    totalBeds,
    occupiedBeds,
  }
}

// ─────────────────────────────────────────────────────────────
// Owner: create building
// ─────────────────────────────────────────────────────────────
export async function createBuildingService(
  ownerId: string,
  dto: Record<string, unknown>
) {
  const amenities = Array.isArray(dto.amenities)
    ? dto.amenities.filter((a): a is string => typeof a === "string")
    : []

  const building = await prisma.building.create({
    data: {
      ownerId,
      name: dto.name as string,
      type: dto.type as never,
      genderPreference: dto.genderPreference as never,
      addressLine1: dto.addressLine1 as string,
      addressLine2: dto.addressLine2 as string | undefined,
      landmark: dto.landmark as string | undefined,
      city: dto.city as string,
      state: dto.state as string,
      pincode: dto.pincode as string,
      latitude: dto.latitude as number | undefined,
      longitude: dto.longitude as number | undefined,
      totalFloors: dto.totalFloors as number,
      description: dto.description as string | undefined,
      rules: dto.rules as string | undefined,
      depositMonths: (dto.depositMonths as number | undefined) ?? 2,
      depositFixed: dto.depositFixed as number | undefined,
      rentDueDay: dto.rentDueDay as number,
      contactPhone: dto.contactPhone as string | undefined,
      contactEmail: dto.contactEmail as string | undefined,
      googleMapsUrl: dto.googleMapsUrl as string | undefined,
      amenities: amenities.length
        ? {
            create: amenities.map((name) => ({ name })),
          }
        : undefined,
    },
    select: {
      id: true,
      name: true,
      status: true,
    },
  })

  return building
}

// ─────────────────────────────────────────────────────────────
// Owner: update building
// ─────────────────────────────────────────────────────────────
export async function updateBuildingService(
  buildingId: string,
  ownerId: string,
  dto: Record<string, unknown>
) {
  const existing = await prisma.building.findFirst({
    where: {
      id: buildingId,
      ownerId,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (!existing) {
    throw new NotFoundError('Building not found')
  }

  const amenities = Array.isArray(dto.amenities)
    ? dto.amenities.filter((a): a is string => typeof a === "string")
    : undefined

  await prisma.building.update({
    where: { id: buildingId },
    data: {
      ...(dto.name !== undefined ? { name: dto.name as string } : {}),
      ...(dto.genderPreference !== undefined
        ? { genderPreference: dto.genderPreference as never }
        : {}),
      ...(dto.addressLine1 !== undefined ? { addressLine1: dto.addressLine1 as string } : {}),
      ...(dto.addressLine2 !== undefined ? { addressLine2: dto.addressLine2 as string } : {}),
      ...(dto.landmark !== undefined ? { landmark: dto.landmark as string } : {}),
      ...(dto.city !== undefined ? { city: dto.city as string } : {}),
      ...(dto.state !== undefined ? { state: dto.state as string } : {}),
      ...(dto.pincode !== undefined ? { pincode: dto.pincode as string } : {}),
      ...(dto.latitude !== undefined ? { latitude: dto.latitude as number } : {}),
      ...(dto.longitude !== undefined ? { longitude: dto.longitude as number } : {}),
      ...(dto.totalFloors !== undefined ? { totalFloors: dto.totalFloors as number } : {}),
      ...(dto.description !== undefined ? { description: dto.description as string } : {}),
      ...(dto.rules !== undefined ? { rules: dto.rules as string } : {}),
      ...(dto.depositMonths !== undefined ? { depositMonths: dto.depositMonths as number } : {}),
      ...(dto.depositFixed !== undefined ? { depositFixed: dto.depositFixed as number } : {}),
      ...(dto.rentDueDay !== undefined ? { rentDueDay: dto.rentDueDay as number } : {}),
      ...(dto.contactPhone !== undefined ? { contactPhone: dto.contactPhone as string } : {}),
      ...(dto.contactEmail !== undefined ? { contactEmail: dto.contactEmail as string } : {}),
      ...(dto.googleMapsUrl !== undefined ? { googleMapsUrl: dto.googleMapsUrl as string } : {}),
      ...(amenities !== undefined
        ? {
            amenities: {
              deleteMany: {},
              create: amenities.map((name) => ({ name })),
            },
          }
        : {}),
    },
  })

  return { id: buildingId }
}

// ─────────────────────────────────────────────────────────────
// Owner: delete building (soft delete)
// ─────────────────────────────────────────────────────────────
export async function deleteBuildingService(buildingId: string, ownerId: string) {
  const building = await prisma.building.findFirst({
    where: {
      id: buildingId,
      ownerId,
      deletedAt: null,
    },
    select: { id: true },
  })

  if (!building) {
    throw new NotFoundError('Building not found')
  }

  const activeBeds = await prisma.bed.count({
    where: {
      buildingId,
      deletedAt: null,
      status: {
        in: ['OCCUPIED', 'RESERVED'],
      },
    },
  })

  if (activeBeds > 0) {
    throw new BadRequestError(
      'Cannot delete a building with active or reserved tenants.',
      'ACTIVE_TENANTS_EXIST'
    )
  }

  await prisma.building.update({
    where: { id: buildingId },
    data: {
      deletedAt: new Date(),
      status: 'INACTIVE',
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Update building live/inactive status
// ─────────────────────────────────────────────────────────────
export async function updateBuildingStatusService(
  buildingId: string,
  ownerId: string,
  status: 'ACTIVE' | 'INACTIVE'
) {
  const building = await prisma.building.findFirst({
    where: {
      id: buildingId,
      ownerId,
      deletedAt: null,
    },
    include: {
      _count: {
        select: {
          beds: {
            where: {
              status: 'VACANT',
              deletedAt: null,
            },
          },
        },
      },
    },
  })

  if (!building) {
    throw new NotFoundError('Building not found')
  }

  if (status === 'ACTIVE') {
    const owner = await prisma.ownerProfile.findUnique({
      where: { id: ownerId },
      select: { verificationStatus: true },
    })

    if (owner?.verificationStatus !== 'VERIFIED') {
      throw new BadRequestError(
        'Your account must be verified before going live.',
        'OWNER_NOT_VERIFIED'
      )
    }

    if (!building.latitude || !building.longitude) {
      throw new BadRequestError(
        'Please add the building location (latitude/longitude) before going live.',
        'MISSING_LOCATION'
      )
    }

    if (building._count.beds === 0) {
      throw new BadRequestError(
        'Add at least one vacant bed before making this building live.',
        'NO_VACANT_BEDS'
      )
    }
  }

  await prisma.building.update({
    where: { id: buildingId },
    data: { status },
  })

  return {
    status,
    message:
      status === 'ACTIVE'
        ? 'Building is now live and discoverable by tenants'
        : 'Building is now inactive',
  }
}

// ─────────────────────────────────────────────────────────────
// Public property search
// ─────────────────────────────────────────────────────────────
/** Mean Earth radius, km. */
const EARTH_RADIUS_KM = 6371
const KM_PER_DEGREE_LAT = 111.045

/** Most candidates a single proximity search will rank. */
const NEARBY_CANDIDATE_CAP = 500

const toRad = (deg: number) => (deg * Math.PI) / 180

/**
 * Great-circle distance between two points, in kilometres.
 *
 * Haversine is accurate enough at city scale and needs no database extension —
 * PostGIS would be the answer if this ever had to sort millions of rows.
 */
function haversineKm(
  aLat: number, aLng: number,
  bLat: number, bLng: number
): number {
  const dLat = toRad(bLat - aLat)
  const dLng = toRad(bLng - aLng)

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h))
}

/**
 * A latitude/longitude box that fully contains the search circle.
 *
 * Used to narrow candidates in SQL before the exact distance is computed in
 * memory: a box comparison is indexable, a trigonometric one is not. Longitude
 * degrees shrink towards the poles, hence the cosine term.
 */
function boundingBox(lat: number, lng: number, radiusKm: number) {
  const latDelta = radiusKm / KM_PER_DEGREE_LAT
  // Guard the cosine so a near-polar search cannot divide by ~0.
  const lngDelta = radiusKm / (KM_PER_DEGREE_LAT * Math.max(Math.cos(toRad(lat)), 0.01))

  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  }
}

export async function searchPropertiesService(query: Record<string, unknown>) {
  const {
    city,
    type,
    genderPreference,
    minRent,
    maxRent,
    lat: _lat,
    lng: _lng,
    radiusKm: _radiusKm,
    page: _page,
    limit: _limit,
  } = query as {
    city?: string
    type?: string
    genderPreference?: string
    minRent?: string
    maxRent?: string
    lat?: string
    lng?: string
    radiusKm?: string
    page?: string
    limit?: string
  }

  const page = Math.max(1, parseInt(_page ?? '1', 10))
  const limit = Math.min(50, parseInt(_limit ?? '20', 10))
  const skip = (page - 1) * limit

  // Proximity search is active only when both coordinates are present and sane.
  const lat = _lat !== undefined ? Number(_lat) : NaN
  const lng = _lng !== undefined ? Number(_lng) : NaN
  const nearby =
    Number.isFinite(lat) && Number.isFinite(lng) &&
    Math.abs(lat) <= 90 && Math.abs(lng) <= 180

  const radiusKm = nearby
    ? Math.min(100, Math.max(0.5, Number(_radiusKm ?? 10) || 10))
    : 0

  const where: Record<string, unknown> = {
    status: 'ACTIVE',
    deletedAt: null,
    ...(city && {
      city: {
        contains: city,
        mode: 'insensitive',
      },
    }),
    ...(type && { type }),
    ...(genderPreference && { genderPreference }),
  }

  if (nearby) {
    const box = boundingBox(lat, lng, radiusKm)
    // Indexed by @@index([latitude, longitude]). Buildings with no coordinates
    // cannot be ranked by distance, so they drop out of a nearby search.
    where.latitude  = { gte: box.minLat, lte: box.maxLat }
    where.longitude = { gte: box.minLng, lte: box.maxLng }
  }

  // A nearby search has to rank the whole candidate set by distance before it
  // can paginate, so the page window is applied afterwards. The cap keeps a
  // large radius from pulling the entire table.
  const pageArgs: { skip?: number; take: number } = nearby
    ? { take: NEARBY_CANDIDATE_CAP }
    : { skip, take: limit }

  const [buildings, total] = await Promise.all([
    prisma.building.findMany({
      where,
      ...pageArgs,
      include: {
        amenities: {
          select: { name: true },
        },
        photos: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { fileUrl: true },
        },
        beds: {
          where: {
            status: 'VACANT',
            deletedAt: null,
          },
          select: {
            monthlyRent: true,
          },
        },
      },
    }),
    prisma.building.count({ where }),
  ])

  const items = buildings
    .map((b) => {
      const rents = b.beds.map((bed) => Number(bed.monthlyRent))

      return {
        id: b.id,
        name: b.name,
        type: b.type,
        genderPreference: b.genderPreference,
        city: b.city,
        addressLine1: b.addressLine1,
        landmark: b.landmark,
        latitude: b.latitude ? Number(b.latitude) : null,
        longitude: b.longitude ? Number(b.longitude) : null,
        minRent: rents.length ? Math.min(...rents) : null,
        maxRent: rents.length ? Math.max(...rents) : null,
        vacantBeds: b.beds.length,
        amenities: b.amenities.map((a) => a.name),
        coverPhoto: b.photos[0]?.fileUrl ?? null,
        distanceKm:
          nearby && b.latitude !== null && b.longitude !== null
            ? Math.round(
                haversineKm(lat, lng, Number(b.latitude), Number(b.longitude)) * 10
              ) / 10
            : null,
      }
    })
    .filter((item) => {
      if (minRent && item.minRent !== null && item.minRent < Number(minRent)) {
        return false
      }
      if (maxRent && item.maxRent !== null && item.maxRent > Number(maxRent)) {
        return false
      }
      return true
    })

  // The bounding box is a square around a circle, so trim the corners and rank
  // by true distance before slicing the page out.
  const ranked = nearby
    ? items
        .filter((i) => i.distanceKm !== null && i.distanceKm <= radiusKm)
        .sort((a, b) => (a.distanceKm ?? 0) - (b.distanceKm ?? 0))
    : items

  const paged = nearby ? ranked.slice(skip, skip + limit) : ranked
  const matched = nearby ? ranked.length : items.length
  const totalPages = Math.max(1, Math.ceil(matched / limit))

  return {
    items: paged,
    searchedNearby: nearby,
    radiusKm: nearby ? radiusKm : null,
    pagination: {
      page,
      limit,
      total: matched,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

// ─────────────────────────────────────────────────────────────
// Public property detail
// ─────────────────────────────────────────────────────────────
export async function getPublicPropertyService(
  buildingId: string,
  _viewerUserId?: string
) {
  const building = await prisma.building.findFirst({
    where: {
      id: buildingId,
      status: 'ACTIVE',
      deletedAt: null,
    },
    include: {
      amenities: {
        select: { name: true },
      },
      photos: {
        orderBy: { sortOrder: 'asc' },
      },
      rooms: {
        where: {
          deletedAt: null,
        },
        include: {
          amenities: {
            select: { name: true },
          },
          beds: {
            where: {
              status: 'VACANT',
              deletedAt: null,
            },
            select: {
              id: true,
              bedLabel: true,
              monthlyRent: true,
            },
          },
        },
      },
    },
  })

  if (!building) {
    throw new NotFoundError('Property not found')
  }

  // A compatibility score needs the viewer's own lifestyle answers. Anonymous
  // visitors get none, which is why this is optionalAuth rather than required.
  const viewerPreferences = _viewerUserId
    ? (await prisma.tenantProfile.findUnique({
        where:   { userId: _viewerUserId },
        select:  { preferences: true },
      }))?.preferences ?? null
    : null

  const roomOptions = await Promise.all(
    building.rooms.map(async (room) => {
      const activeTenants = await prisma.tenantProfile.findMany({
        where: {
          currentBed: {
            some: {
              roomId: room.id,
              status: 'OCCUPIED',
            },
          },
        },
        include: {
          preferences: true,
        },
        take: 10,
      })

      const compatibilityInfo = activeTenants.map((t) => ({
        gender: t.gender,
        smoking: t.preferences?.smoking,
        foodPreference: t.preferences?.foodPreference,
        sleepSchedule: t.preferences?.sleepSchedule,
        compatibilityBio: t.preferences?.compatibilityBio,
      }))

      // Only worth scoring where someone would actually be sharing: a private
      // room has nobody to match against, and an empty shared room has nothing
      // to compare.
      const isShared = room.capacity > 1
      const compatibility = isShared && activeTenants.length > 0
        ? scoreCompatibility(
            viewerPreferences,
            activeTenants.map((t) => t.preferences)
          )
        : null

      return {
        id: room.id,
        type: room.type,
        capacity: room.capacity,
        baseRent: Number(room.baseRent),
        amenities: room.amenities.map((a) => a.name),
        vacantBeds: room.beds.length,
        vacantBedDetails: room.beds.map((bed) => ({
          id: bed.id,
          bedLabel: bed.bedLabel,
          monthlyRent: Number(bed.monthlyRent),
        })),
        compatibilityInfo,
        compatibility,
      }
    })
  )

  return {
    id: building.id,
    name: building.name,
    type: building.type,
    genderPreference: building.genderPreference,
    description: building.description,
    rules: building.rules,
    addressLine1: building.addressLine1,
    city: building.city,
    pincode: building.pincode,
    latitude: building.latitude ? Number(building.latitude) : null,
    longitude: building.longitude ? Number(building.longitude) : null,
    depositMonths: building.depositMonths,
    rentDueDay: building.rentDueDay,
    contactPhone: building.contactPhone,
    amenities: building.amenities.map((a) => a.name),
    photos: building.photos,
    roomOptions,
  }
}

import { prisma } from '@config/prisma'
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
export async function searchPropertiesService(query: Record<string, unknown>) {
  const {
    city,
    type,
    genderPreference,
    minRent,
    maxRent,
    page: _page,
    limit: _limit,
  } = query as {
    city?: string
    type?: string
    genderPreference?: string
    minRent?: string
    maxRent?: string
    page?: string
    limit?: string
  }

  const page = Math.max(1, parseInt(_page ?? '1', 10))
  const limit = Math.min(50, parseInt(_limit ?? '20', 10))
  const skip = (page - 1) * limit

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

  const [buildings, total] = await Promise.all([
    prisma.building.findMany({
      where,
      skip,
      take: limit,
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

  return {
    items,
    pagination: {
      page,
      limit,
      total: items.length,
      totalPages: Math.ceil(items.length / limit),
      hasNext: page < Math.ceil(items.length / limit),
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

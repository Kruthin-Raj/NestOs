import { prisma } from '@config/prisma'
import { BadRequestError, NotFoundError, ConflictError } from '@utils/errors'
import { RoomType } from '@prisma/client'

async function assertBuildingOwnership(buildingId: string, ownerId: string) {
  const b = await prisma.building.findFirst({
    where: { id: buildingId, ownerId, deletedAt: null }, select: { id: true },
  })
  if (!b) throw new NotFoundError('Building not found')
}

export async function getRoomsService(
  buildingId: string, ownerId: string, query: Record<string, unknown>
) {
  await assertBuildingOwnership(buildingId, ownerId)
  const { floorId, type, hasVacancy } = query as Record<string, string>

  const rooms = await prisma.room.findMany({
    where: {
      buildingId,
      deletedAt: null,
      ...(floorId && { floorId }),
      ...(type && { type: type as RoomType }),
    },
    include: {
      amenities: { select: { name: true } },
      beds: {
        where: { deletedAt: null },
        include: {
          currentTenant: {
            select: {
              id: true, fullName: true,
              currentBed: {
                where: { buildingId },
                include: { bookings: { where: { status: 'CONFIRMED' }, select: { moveInDate: true }, take: 1 } },
              },
            },
          },
        },
      },
    },
    orderBy: { roomNumber: 'asc' },
  })

  const filtered = hasVacancy === 'true'
    ? rooms.filter((r) => r.beds.some((b) => b.status === 'VACANT'))
    : rooms

  return {
    rooms: filtered.map((r) => ({
      ...r,
      beds: r.beds.map((b) => ({
        id: b.id, bedLabel: b.bedLabel,
        status: b.status, monthlyRent: b.monthlyRent,
        currentTenant: b.currentTenant
          ? {
              id:          b.currentTenant.id,
              fullName:    b.currentTenant.fullName,
              moveInDate:  b.currentTenant.currentBed[0]?.bookings[0]?.moveInDate ?? null,
            }
          : null,
      })),
    })),
  }
}

export async function createRoomService(
  buildingId: string, ownerId: string,
  dto: {
    floorId: string; roomNumber: string; type: RoomType
    capacity: number; baseRent: number; description?: string
    amenities?: string[]
  }
) {
  await assertBuildingOwnership(buildingId, ownerId)

  // Capacity rules
  if (dto.type === 'PRIVATE' && dto.capacity !== 1)
    throw new BadRequestError('Private rooms must have capacity of 1')
  if (dto.type === 'SHARED' && (dto.capacity < 2 || dto.capacity > 4))
    throw new BadRequestError('Shared rooms must have capacity of 2-4')
  if (dto.type === 'DORMITORY' && (dto.capacity < 5 || dto.capacity > 20))
    throw new BadRequestError('Dormitory rooms must have capacity of 5-20')

  // Validate floor belongs to this building
  const floor = await prisma.floor.findFirst({
    where: { id: dto.floorId, buildingId, deletedAt: null }, select: { id: true },
  })
  if (!floor) throw new NotFoundError('Floor not found in this building')

  const { amenities, ...roomData } = dto
  return prisma.room.create({
    data: {
      ...roomData,
      buildingId,
      amenities: amenities
        ? { create: amenities.map((name) => ({ name })) }
        : undefined,
    },
    select: { id: true, roomNumber: true },
  })
}

export async function updateRoomService(
  buildingId: string, roomId: string, ownerId: string,
  dto: Partial<{ baseRent: number; description: string; amenities: string[] }>
) {
  const room = await prisma.room.findFirst({
    where: { id: roomId, buildingId, deletedAt: null },
    include: { _count: { select: { beds: { where: { status: { in: ['OCCUPIED', 'RESERVED'] } } } } } },
  })
  if (!room) throw new NotFoundError('Room not found')
  await assertBuildingOwnership(buildingId, ownerId)

  const { amenities, ...roomData } = dto
  return prisma.room.update({
    where: { id: roomId },
    data: {
      ...roomData,
      ...(amenities !== undefined && {
        amenities: {
          deleteMany: {},
          create: amenities.map((name) => ({ name })),
        },
      }),
    },
    select: { id: true },
  })
}

export async function deleteRoomService(
  buildingId: string, roomId: string, ownerId: string
) {
  await assertBuildingOwnership(buildingId, ownerId)
  const occupied = await prisma.bed.count({
    where: { roomId, status: { in: ['OCCUPIED', 'RESERVED'] }, deletedAt: null },
  })
  if (occupied > 0) throw new BadRequestError(
    'Cannot delete a room with active tenants.', 'ACTIVE_TENANTS_EXIST'
  )
  await prisma.room.update({ where: { id: roomId }, data: { deletedAt: new Date() } })
  // Cascade soft-delete beds
  await prisma.bed.updateMany({
    where: { roomId, deletedAt: null },
    data:  { deletedAt: new Date() },
  })
}
// ─────────────────────────────────────────────────────────────
// Bulk room creation
//
// Adding a 100-room apartment one form at a time is the single most tedious
// thing an owner does here. This generates a numbered run of identical rooms,
// with their beds, in one transaction.
// ─────────────────────────────────────────────────────────────

interface BulkRoomsDto {
  floorId:     string
  startNumber: number
  count:       number
  type:        RoomType
  capacity:    number
  baseRent:    number
  /** Prefixed to every generated number, e.g. "A-" gives A-101, A-102. */
  prefix?:     string
  /** Pads the number to this width, so 1 becomes 001. */
  padTo?:      number
  amenities?:  string[]
  /** Beds per room are labelled A, B, C… or 1, 2, 3… */
  bedLabelStyle?: 'ALPHA' | 'NUMERIC'
  /** Defaults to the room's baseRent. */
  bedRent?:    number
}

/** "A-", 101, pad 3 -> "A-101". Kept pure so the UI can preview identically. */
function buildRoomNumber(prefix: string, value: number, padTo: number): string {
  return `${prefix}${String(value).padStart(padTo, '0')}`
}

function bedLabel(index: number, style: 'ALPHA' | 'NUMERIC'): string {
  if (style === 'NUMERIC') return String(index + 1)
  // A..Z, then AA, AB… so a 30-bed dormitory still gets unique labels.
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

export async function createRoomsBulkService(
  buildingId: string,
  ownerId: string,
  dto: BulkRoomsDto
) {
  await assertBuildingOwnership(buildingId, ownerId)

  // Same capacity rules as a single room — a bulk path must not be a way to
  // sidestep validation.
  if (dto.type === 'PRIVATE' && dto.capacity !== 1)
    throw new BadRequestError('Private rooms must have capacity of 1')
  if (dto.type === 'SHARED' && (dto.capacity < 2 || dto.capacity > 4))
    throw new BadRequestError('Shared rooms must have capacity of 2-4')
  if (dto.type === 'DORMITORY' && (dto.capacity < 5 || dto.capacity > 20))
    throw new BadRequestError('Dormitory rooms must have capacity of 5-20')

  const floor = await prisma.floor.findFirst({
    where:  { id: dto.floorId, buildingId, deletedAt: null },
    select: { id: true },
  })
  if (!floor) throw new NotFoundError('Floor not found in this building')

  const prefix = dto.prefix ?? ''
  const padTo  = dto.padTo ?? 0
  const style  = dto.bedLabelStyle ?? 'ALPHA'
  const bedRent = dto.bedRent ?? dto.baseRent

  const wanted = Array.from({ length: dto.count }, (_, i) =>
    buildRoomNumber(prefix, dto.startNumber + i, padTo)
  )

  // roomNumber is unique per building, so anything that already exists is
  // reported back rather than failing the whole batch.
  const existing = await prisma.room.findMany({
    where:  { buildingId, roomNumber: { in: wanted }, deletedAt: null },
    select: { roomNumber: true },
  })
  const taken = new Set(existing.map((r) => r.roomNumber))
  const toCreate = wanted.filter((n) => !taken.has(n))

  if (toCreate.length === 0) {
    throw new ConflictError(
      'Every room number in that range already exists in this building.',
      'ALL_ROOMS_EXIST'
    )
  }

  const created = await prisma.$transaction(async (tx) => {
    const rooms: Array<{ id: string; roomNumber: string }> = []

    for (const roomNumber of toCreate) {
      const room = await tx.room.create({
        data: {
          buildingId,
          floorId:    dto.floorId,
          roomNumber,
          type:       dto.type,
          capacity:   dto.capacity,
          baseRent:   dto.baseRent,
          amenities:  dto.amenities?.length
            ? { create: dto.amenities.map((name) => ({ name })) }
            : undefined,
          beds: {
            create: Array.from({ length: dto.capacity }, (_, i) => ({
              buildingId,
              bedLabel:    bedLabel(i, style),
              monthlyRent: bedRent,
            })),
          },
        },
        select: { id: true, roomNumber: true },
      })

      rooms.push(room)
    }

    // Kept in step with createBedService, which maintains this counter.
    await tx.building.update({
      where: { id: buildingId },
      data:  { totalBeds: { increment: toCreate.length * dto.capacity } },
    })

    return rooms
  })

  return {
    createdRooms: created.length,
    createdBeds:  created.length * dto.capacity,
    rooms:        created,
    skipped:      [...taken],
  }
}

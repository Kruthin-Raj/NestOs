import { prisma } from '@config/prisma'
import { BadRequestError, NotFoundError } from '@utils/errors'
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
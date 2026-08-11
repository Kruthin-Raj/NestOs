import { prisma } from '@config/prisma'
import { BadRequestError, NotFoundError, ConflictError } from '@utils/errors'

async function assertBuildingOwnership(buildingId: string, ownerId: string) {
  const b = await prisma.building.findFirst({
    where: { id: buildingId, ownerId, deletedAt: null },
    select: { id: true },
  })
  if (!b) throw new NotFoundError('Building not found')
  return b
}

export async function getFloorsService(buildingId: string, ownerId: string) {
  await assertBuildingOwnership(buildingId, ownerId)
  return prisma.floor.findMany({
    where: { buildingId, deletedAt: null },
    orderBy: { floorNumber: 'asc' },
    include: {
      rooms: {
        where: { deletedAt: null },
        select: {
          id: true, roomNumber: true, type: true,
          capacity: true, currentCount: true, baseRent: true,
          _count: { select: { beds: { where: { status: 'VACANT', deletedAt: null } } } },
        },
      },
    },
  })
}

export async function createFloorService(
  buildingId: string, ownerId: string,
  dto: { floorNumber: number; label?: string }
) {
  await assertBuildingOwnership(buildingId, ownerId)
  const exists = await prisma.floor.findFirst({
    where: { buildingId, floorNumber: dto.floorNumber, deletedAt: null },
  })
  if (exists) throw new ConflictError(`Floor ${dto.floorNumber} already exists in this building`)
  return prisma.floor.create({ data: { buildingId, ...dto } })
}

export async function deleteFloorService(buildingId: string, floorId: string, ownerId: string) {
  await assertBuildingOwnership(buildingId, ownerId)
  const occupiedRooms = await prisma.bed.count({
    where: {
      room: { floorId },
      status: { in: ['OCCUPIED', 'RESERVED'] },
      deletedAt: null,
    },
  })
  if (occupiedRooms > 0) {
    throw new BadRequestError(
      'Cannot remove a floor with active or reserved tenants.',
      'ACTIVE_TENANTS_EXIST'
    )
  }
  await prisma.floor.update({ where: { id: floorId }, data: { deletedAt: new Date() } })
}
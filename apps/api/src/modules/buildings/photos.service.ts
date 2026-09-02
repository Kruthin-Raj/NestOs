import { prisma } from '@config/prisma'
import { NotFoundError } from '@utils/errors'

async function assertBuildingOwnership(buildingId: string, ownerId: string) {
  const b = await prisma.building.findFirst({
    where: { id: buildingId, ownerId, deletedAt: null }, select: { id: true },
  })
  if (!b) throw new NotFoundError('Building not found')
}

export async function addBuildingPhotoService(
  buildingId: string,
  ownerId: string,
  dto: { fileUrl: string; fileKey: string; caption?: string }
) {
  await assertBuildingOwnership(buildingId, ownerId)

  // Get current max sortOrder
  const lastPhoto = await prisma.buildingPhoto.findFirst({
    where: { buildingId },
    orderBy: { sortOrder: 'desc' },
  })
  
  const sortOrder = lastPhoto ? lastPhoto.sortOrder + 1 : 0

  return prisma.buildingPhoto.create({
    data: {
      buildingId,
      fileUrl: dto.fileUrl,
      fileKey: dto.fileKey,
      caption: dto.caption,
      sortOrder,
    },
  })
}

export async function addRoomPhotoService(
  buildingId: string,
  roomId: string,
  ownerId: string,
  dto: { fileUrl: string; fileKey: string; caption?: string }
) {
  // Use existing assertBuildingOwnership from the file it's placed in
  await assertBuildingOwnership(buildingId, ownerId)
  
  const room = await prisma.room.findFirst({
    where: { id: roomId, buildingId, deletedAt: null }
  })
  if (!room) throw new NotFoundError('Room not found in this building')

  const lastPhoto = await prisma.roomPhoto.findFirst({
    where: { roomId },
    orderBy: { sortOrder: 'desc' },
  })
  
  const sortOrder = lastPhoto ? lastPhoto.sortOrder + 1 : 0

  return prisma.roomPhoto.create({
    data: {
      roomId,
      fileUrl: dto.fileUrl,
      fileKey: dto.fileKey,
      caption: dto.caption,
      sortOrder,
    },
  })
}

import { prisma } from '@config/prisma'
import { NotFoundError } from '@utils/errors'
import { NoticeTargetType, NoticeCategory } from '@prisma/client'
import { parsePagination } from '@utils/pagination.util'
import { buildPaginationMeta } from '@utils/response.util'

export async function createNoticeService(
  ownerId: string,
  dto: {
    title: string
    body: string
    category: NoticeCategory
    targetType: NoticeTargetType
    targetBuildingId?: string
    targetFloorId?: string
    targetRoomId?: string
    targetTenantId?: string
    publishAt?: string
    expiresAt?: string
    sendEmail?: boolean
  }
) {
  if (dto.targetBuildingId) {
    const b = await prisma.building.findFirst({
      where: { id: dto.targetBuildingId, ownerId, deletedAt: null },
    })
    if (!b) throw new NotFoundError('Target building not found')
  }

  let recipientCount = 0

  if (dto.targetType === 'ALL_BUILDINGS') {
    recipientCount = await prisma.booking.count({
      where: { ownerId, status: 'CONFIRMED' },
    })
  } else if (dto.targetType === 'BUILDING' && dto.targetBuildingId) {
    recipientCount = await prisma.booking.count({
      where: { buildingId: dto.targetBuildingId, status: 'CONFIRMED' },
    })
  } else if (dto.targetType === 'FLOOR' && dto.targetFloorId) {
    const rooms = await prisma.room.findMany({
      where: { floorId: dto.targetFloorId, deletedAt: null },
      select: { id: true },
    })

    const roomIds = rooms.map((r) => r.id)

    recipientCount = roomIds.length
      ? await prisma.booking.count({
          where: {
            roomId: { in: roomIds },
            status: 'CONFIRMED',
          },
        })
      : 0
  } else if (dto.targetType === 'ROOM' && dto.targetRoomId) {
    recipientCount = await prisma.booking.count({
      where: { roomId: dto.targetRoomId, status: 'CONFIRMED' },
    })
  } else if (dto.targetType === 'TENANT' && dto.targetTenantId) {
    recipientCount = 1
  }

  const notice = await prisma.notice.create({
    data: {
      ownerId,
      title: dto.title,
      body: dto.body,
      category: dto.category,
      targetType: dto.targetType,
      targetBuildingId: dto.targetBuildingId,
      targetFloorId: dto.targetFloorId,
      targetRoomId: dto.targetRoomId,
      targetTenantId: dto.targetTenantId,
      publishAt: dto.publishAt ? new Date(dto.publishAt) : new Date(),
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : undefined,
      sendEmail: dto.sendEmail ?? false,
    },
    select: {
      id: true,
      title: true,
      targetType: true,
      publishAt: true,
    },
  })

  return { ...notice, recipientCount }
}

export async function getOwnerNoticesService(ownerId: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query)
  const { buildingId, category } = query as Record<string, string>

  const where = {
    ownerId,
    deletedAt: null,
    ...(buildingId && { targetBuildingId: buildingId }),
    ...(category && { category: category as NoticeCategory }),
  }

  const [notices, total] = await Promise.all([
    prisma.notice.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        targetBuilding: { select: { name: true } },
        _count: { select: { reads: true } },
      },
    }),
    prisma.notice.count({ where }),
  ])

  return {
    items: notices.map((n) => ({
      id: n.id,
      title: n.title,
      category: n.category,
      targetType: n.targetType,
      targetBuilding: n.targetBuilding,
      publishAt: n.publishAt,
      expiresAt: n.expiresAt,
      readCount: n._count.reads,
      createdAt: n.createdAt,
    })),
    pagination: buildPaginationMeta(page, limit, total),
  }
}

export async function deleteNoticeService(noticeId: string, ownerId: string) {
  const notice = await prisma.notice.findFirst({
    where: { id: noticeId, ownerId, deletedAt: null },
  })

  if (!notice) throw new NotFoundError('Notice not found')

  await prisma.notice.update({
    where: { id: noticeId },
    data: { deletedAt: new Date() },
  })
}

export async function getTenantNoticesService(
  tenantUserId: string,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query)
  const { unreadOnly, category } = query as Record<string, string>

  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId },
    select: { id: true },
  })

  if (!tenant) throw new NotFoundError('Tenant profile not found')

  const booking = await prisma.booking.findFirst({
    where: { tenantId: tenant.id, status: 'CONFIRMED' },
    select: {
      buildingId: true,
      roomId: true,
    },
  })

  let floorId: string | null = null

  if (booking?.roomId) {
    const room = await prisma.room.findUnique({
      where: { id: booking.roomId },
      select: { floorId: true },
    })
    floorId = room?.floorId ?? null
  }

  const now = new Date()

  const targetConditions: Array<Record<string, unknown>> = [
    { targetType: 'ALL_BUILDINGS' },
    { targetType: 'TENANT', targetTenantId: tenant.id },
  ]

  if (booking) {
    targetConditions.push({
      targetType: 'BUILDING',
      targetBuildingId: booking.buildingId,
    })

    if (floorId) {
      targetConditions.push({
        targetType: 'FLOOR',
        targetFloorId: floorId,
      })
    }

    targetConditions.push({
      targetType: 'ROOM',
      targetRoomId: booking.roomId,
    })
  }

  const noticeWhere = {
    deletedAt: null,
    publishAt: { lte: now },
    OR: [
      { expiresAt: null },
      { expiresAt: { gt: now } },
    ],
    AND: [
      { OR: targetConditions },
      ...(category ? [{ category: category as NoticeCategory }] : []),
    ],
  }

  const [notices, total] = await Promise.all([
    prisma.notice.findMany({
      where: noticeWhere,
      skip,
      take: limit,
      orderBy: { publishAt: 'desc' },
      include: {
        reads: {
          where: { tenantId: tenant.id },
          select: { readAt: true },
          take: 1,
        },
      },
    }),
    prisma.notice.count({ where: noticeWhere }),
  ])

  const enriched = notices.map((n) => ({
    id: n.id,
    title: n.title,
    body: n.body,
    category: n.category,
    publishAt: n.publishAt,
    isRead: n.reads.length > 0,
    readAt: n.reads[0]?.readAt ?? null,
    createdAt: n.createdAt,
  }))

  const unreadCount = await prisma.notice.count({
    where: {
      ...noticeWhere,
      reads: {
        none: { tenantId: tenant.id },
      },
    },
  })

  const items = unreadOnly === 'true'
    ? enriched.filter((n) => !n.isRead)
    : enriched

  return {
    items,
    pagination: buildPaginationMeta(page, limit, total),
    unreadCount,
  }
}

export async function markNoticeReadService(noticeId: string, tenantUserId: string) {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId },
    select: { id: true },
  })

  if (!tenant) throw new NotFoundError('Tenant profile not found')

  await prisma.noticeRead.upsert({
    where: { noticeId_tenantId: { noticeId, tenantId: tenant.id } },
    update: {},
    create: { noticeId, tenantId: tenant.id },
  })

  return { readAt: new Date() }
}
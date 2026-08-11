import { prisma } from '@config/prisma'
import { BadRequestError, NotFoundError, ConflictError } from '@utils/errors'

async function assertBuildingOwnership(buildingId: string, ownerId: string) {
  const b = await prisma.building.findFirst({
    where: { id: buildingId, ownerId, deletedAt: null },
    select: { id: true },
  })

  if (!b) throw new NotFoundError('Building not found')
}

export async function getBedsService(
  buildingId: string,
  roomId: string,
  ownerId: string
) {
  await assertBuildingOwnership(buildingId, ownerId)

  const beds = await prisma.bed.findMany({
    where: { roomId, buildingId, deletedAt: null },
    include: {
      currentTenant: {
        select: { id: true, fullName: true, phone: true },
      },
    },
    orderBy: { bedLabel: 'asc' },
  })

  const now = new Date()

  const results = await Promise.all(
    beds.map(async (bed) => {
      let paymentStatus: string | null = null

      if (bed.currentTenantId) {
        const payment = await prisma.payment.findFirst({
          where: {
            tenantId: bed.currentTenantId,
            type: 'RENT',
            billingMonth: now.getMonth() + 1,
            billingYear: now.getFullYear(),
          },
          select: { status: true },
        })

        paymentStatus = payment?.status ?? 'PENDING'
      }

      const activeBooking = bed.currentTenantId
        ? await prisma.booking.findFirst({
            where: {
              tenantId: bed.currentTenantId,
              status: 'CONFIRMED',
            },
            select: { moveInDate: true },
          })
        : null

      return {
        id: bed.id,
        bedLabel: bed.bedLabel,
        status: bed.status,
        monthlyRent: Number(bed.monthlyRent),
        notes: bed.notes,
        currentTenant: bed.currentTenant
          ? {
              ...bed.currentTenant,
              moveInDate: activeBooking?.moveInDate ?? null,
              paymentStatus,
            }
          : null,
        createdAt: bed.createdAt,
      }
    })
  )

  return { beds: results }
}

export async function createBedService(
  buildingId: string,
  roomId: string,
  ownerId: string,
  dto: { bedLabel: string; monthlyRent: number; notes?: string }
) {
  await assertBuildingOwnership(buildingId, ownerId)

  const room = await prisma.room.findFirst({
    where: { id: roomId, buildingId, deletedAt: null },
    include: {
      _count: {
        select: {
          beds: {
            where: { deletedAt: null },
          },
        },
      },
    },
  })

  if (!room) throw new NotFoundError('Room not found')

  if (room._count.beds >= room.capacity) {
    throw new BadRequestError(
      `This room is at full capacity (${room.capacity} beds). Remove a bed first or increase room capacity.`,
      'ROOM_AT_CAPACITY'
    )
  }

  const existing = await prisma.bed.findFirst({
    where: { roomId, bedLabel: dto.bedLabel, deletedAt: null },
  })

  if (existing) {
    throw new ConflictError(`Bed "${dto.bedLabel}" already exists in this room`)
  }

  const bed = await prisma.$transaction(async (tx) => {
    const newBed = await tx.bed.create({
      data: {
        roomId,
        buildingId,
        bedLabel: dto.bedLabel,
        monthlyRent: dto.monthlyRent,
        notes: dto.notes,
      },
    })

    await tx.building.update({
      where: { id: buildingId },
      data: { totalBeds: { increment: 1 } },
    })

    return newBed
  })

  return {
    id: bed.id,
    bedLabel: bed.bedLabel,
    status: bed.status,
  }
}

export async function updateBedService(
  buildingId: string,
  roomId: string,
  bedId: string,
  ownerId: string,
  dto: { monthlyRent?: number; notes?: string; status?: 'VACANT' | 'BLOCKED' }
) {
  await assertBuildingOwnership(buildingId, ownerId)

  const bed = await prisma.bed.findFirst({
    where: { id: bedId, roomId, buildingId, deletedAt: null },
  })

  if (!bed) throw new NotFoundError('Bed not found')

  if (dto.status === 'VACANT' && bed.status === 'BLOCKED') {
    const activeBooking = await prisma.booking.findFirst({
      where: {
        bedId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    })

    if (activeBooking) {
      throw new BadRequestError(
        'Cannot unblock a bed that has an active booking.',
        'ACTIVE_BOOKING_EXISTS'
      )
    }
  }

  return prisma.bed.update({
    where: { id: bedId },
    data: {
      ...(dto.monthlyRent !== undefined ? { monthlyRent: dto.monthlyRent } : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
      ...(dto.status !== undefined ? { status: dto.status } : {}),
    },
    select: { id: true, status: true },
  })
}

export async function assignBedService(
  buildingId: string,
  roomId: string,
  bedId: string,
  ownerId: string,
  dto: {
    tenantId: string
    moveInDate: string
    monthlyRent: number
    depositAmount: number
  }
) {
  await assertBuildingOwnership(buildingId, ownerId)

  return prisma.$transaction(async (tx) => {
    const bed = await tx.bed.findFirst({
      where: {
        id: bedId,
        roomId,
        buildingId,
        status: 'VACANT',
        deletedAt: null,
      },
    })

    if (!bed) {
      throw new BadRequestError('Bed is not available', 'BED_NOT_AVAILABLE')
    }

    const tenant = await tx.tenantProfile.findUnique({
      where: { id: dto.tenantId },
    })

    if (!tenant) throw new NotFoundError('Tenant not found')

    if (!tenant.isIdVerified) {
      throw new BadRequestError(
        'Tenant must have verified ID before assignment',
        'ID_NOT_VERIFIED'
      )
    }

    const existingBooking = await tx.booking.findFirst({
      where: {
        tenantId: dto.tenantId,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    })

    if (existingBooking) {
      throw new ConflictError(
        'Tenant already has an active booking',
        'EXISTING_BOOKING'
      )
    }

    const booking = await tx.booking.create({
      data: {
        tenantId: dto.tenantId,
        bedId,
        roomId,
        buildingId,
        ownerId,
        status: 'CONFIRMED',
        moveInDate: new Date(dto.moveInDate),
        monthlyRent: dto.monthlyRent,
        depositAmount: dto.depositAmount,
        depositPaid: true,
      },
    })

    await tx.bed.update({
      where: { id: bedId },
      data: {
        status: 'OCCUPIED',
        currentTenantId: dto.tenantId,
      },
    })

    await tx.tenantProfile.update({
      where: { id: dto.tenantId },
      data: { status: 'ACTIVE' },
    })

    await tx.building.update({
      where: { id: buildingId },
      data: { occupiedBeds: { increment: 1 } },
    })

    await tx.room.update({
      where: { id: roomId },
      data: { currentCount: { increment: 1 } },
    })

    return {
      bookingId: booking.id,
      bedStatus: 'OCCUPIED',
    }
  })
}

export async function releaseBedService(
  buildingId: string,
  roomId: string,
  bedId: string,
  ownerId: string,
  dto: { actualMoveOutDate: string; notes?: string }
) {
  await assertBuildingOwnership(buildingId, ownerId)

  return prisma.$transaction(async (tx) => {
    const bed = await tx.bed.findFirst({
      where: { id: bedId, roomId, buildingId, deletedAt: null },
    })

    if (!bed) throw new NotFoundError('Bed not found')

    if (bed.status !== 'OCCUPIED') {
      throw new BadRequestError(
        'Bed is not currently occupied',
        'BED_NOT_OCCUPIED'
      )
    }

    const booking = await tx.booking.findFirst({
      where: { bedId, status: 'CONFIRMED' },
    })

    if (booking) {
      await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: 'COMPLETED',
          actualMoveOutDate: new Date(dto.actualMoveOutDate),
        },
      })

      await tx.tenantProfile.update({
        where: { id: booking.tenantId },
        data: { status: 'MOVED_OUT' },
      })
    }

    await tx.bed.update({
      where: { id: bedId },
      data: {
        status: 'VACANT',
        currentTenantId: null,
        ...(dto.notes ? { notes: dto.notes } : {}),
      },
    })

    await tx.building.update({
      where: { id: buildingId },
      data: { occupiedBeds: { decrement: 1 } },
    })

    await tx.room.update({
      where: { id: roomId },
      data: { currentCount: { decrement: 1 } },
    })

    return { bedStatus: 'VACANT' }
  })
}
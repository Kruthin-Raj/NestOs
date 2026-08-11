import { prisma } from '@config/prisma'
import { env } from '@config/env'
import { BOOKING, PROFILE } from '@config/constants'
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from '@utils/errors'
import { CreateBookingDto, CancelBookingDto } from './bookings.validation'
import { parsePagination } from '@utils/pagination.util'
import { buildPaginationMeta } from '@utils/response.util'


export async function createBookingService(tenantUserId: string, dto: CreateBookingDto) {
  const tenantProfile = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId },
  })

  if (!tenantProfile) throw new NotFoundError('Tenant profile not found')

  if (!tenantProfile.isIdVerified) {
    throw new BadRequestError(
      'Please verify your identity document before booking.',
      'ID_NOT_VERIFIED'
    )
  }

  if (tenantProfile.profileCompletion < PROFILE.MIN_COMPLETION_TO_BOOK) {
    throw new BadRequestError(
      `Complete at least ${PROFILE.MIN_COMPLETION_TO_BOOK}% of your profile to book. Current: ${tenantProfile.profileCompletion}%`,
      'PROFILE_INCOMPLETE'
    )
  }

  const existingBooking = await prisma.booking.findFirst({
    where: {
      tenantId: tenantProfile.id,
      status: { in: ['PENDING', 'CONFIRMED'] },
    },
  })

  if (existingBooking) {
    throw new ConflictError(
      'You already have an active booking. Cancel it before making a new one.',
      'EXISTING_BOOKING'
    )
  }

  return prisma.$transaction(async (tx) => {
    const beds = await tx.$queryRaw<Array<{
      id: string
      status: string
      monthly_rent: string
      room_id: string
      building_id: string
      bed_label: string
    }>>`
      SELECT id,
             status,
             "monthlyRent" as monthly_rent,
             "roomId" as room_id,
             "buildingId" as building_id,
             "bedLabel" as bed_label
      FROM beds
      WHERE id = ${dto.bedId} AND "deletedAt" IS NULL
      FOR UPDATE
    `

    const bed = beds[0]
    if (!bed) throw new NotFoundError('Bed not found')

    if (bed.status !== 'VACANT') {
      throw new ConflictError(
        'This bed is no longer available. Please choose another.',
        'BED_NOT_AVAILABLE'
      )
    }

    const building = await tx.building.findUnique({
      where: { id: bed.building_id },
    })

    if (!building || building.status !== 'ACTIVE') {
      throw new BadRequestError('This property is not currently accepting bookings')
    }

    const room = await tx.room.findUnique({
      where: { id: bed.room_id },
      select: { roomNumber: true },
    })

    if (!room) throw new NotFoundError('Room not found')

    const monthlyRent = parseFloat(bed.monthly_rent)
    const depositAmount = building.depositFixed
      ? Number(building.depositFixed)
      : monthlyRent * building.depositMonths

    // Get owner's UPI ID for payment
    const ownerProfile = await tx.ownerProfile.findUnique({
      where: { id: building.ownerId },
      select: { upiId: true, fullName: true, businessName: true },
    })

    const booking = await tx.booking.create({
      data: {
        tenantId: tenantProfile.id,
        bedId: dto.bedId,
        roomId: bed.room_id,
        buildingId: bed.building_id,
        ownerId: building.ownerId,
        status: 'PENDING',
        moveInDate: new Date(dto.moveInDate),
        monthlyRent,
        depositAmount,
      },
    })

    await tx.bed.update({
      where: { id: dto.bedId },
      data: { status: 'RESERVED' },
    })

    await tx.tenantProfile.update({
      where: { id: tenantProfile.id },
      data: { status: 'RESERVED' },
    })

    // Build UPI intent URL if owner has UPI ID set
    let upiIntentUrl: string | null = null
    const payeeName = ownerProfile?.businessName || ownerProfile?.fullName || building.name
    if (ownerProfile?.upiId) {
      const params = new URLSearchParams({
        pa: ownerProfile.upiId,
        pn: payeeName,
        am: depositAmount.toFixed(2),
        cu: 'INR',
        tn: `${building.name} - Booking deposit`,
      })
      upiIntentUrl = `upi://pay?${params.toString()}`
    }

    return {
      bookingId: booking.id,
      amountRupees: depositAmount,
      currency: 'INR',
      buildingName: building.name,
      bedLabel: bed.bed_label,
      roomNumber: room.roomNumber,
      moveInDate: booking.moveInDate,
      expiresAt: new Date(Date.now() + BOOKING.PENDING_EXPIRY_MINUTES * 60 * 1000),
      upiIntentUrl,
      payeeUpiId: ownerProfile?.upiId ?? null,
      payeeName,
    }
  })
}

export async function getMyBookingsService(
  tenantUserId: string,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query)

  const tenantProfile = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId },
    select: { id: true },
  })

  if (!tenantProfile) throw new NotFoundError('Tenant profile not found')

  const activeBooking = await prisma.booking.findFirst({
    where: {
      tenantId: tenantProfile.id,
      status: 'CONFIRMED',
    },
    orderBy: { createdAt: 'desc' },
  })

  const [pastBookingsRaw, total] = await Promise.all([
    prisma.booking.findMany({
      where: {
        tenantId: tenantProfile.id,
        status: { notIn: ['CONFIRMED', 'PENDING'] },
      },
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.booking.count({
      where: {
        tenantId: tenantProfile.id,
        status: { notIn: ['CONFIRMED', 'PENDING'] },
      },
    }),
  ])

  let activeBookingResult = null

  if (activeBooking) {
    const building = await prisma.building.findUnique({
      where: { id: activeBooking.buildingId },
      select: {
        id: true,
        name: true,
        addressLine1: true,
        city: true,
        contactPhone: true,
        rentDueDay: true,
      },
    })

    const bed = await prisma.bed.findUnique({
      where: { id: activeBooking.bedId },
      select: { bedLabel: true },
    })

    const room = await prisma.room.findUnique({
      where: { id: activeBooking.roomId },
      select: { roomNumber: true, type: true },
    })

    const now = new Date()
    const dueDay = building?.rentDueDay ?? 5
    let nextRentDue = new Date(now.getFullYear(), now.getMonth(), dueDay)

    if (nextRentDue < now) {
      nextRentDue = new Date(now.getFullYear(), now.getMonth() + 1, dueDay)
    }

    activeBookingResult = {
      ...activeBooking,
      monthlyRent: Number(activeBooking.monthlyRent),
      depositAmount: Number(activeBooking.depositAmount),
      building,
      bed,
      room,
      nextRentDue,
      nextRentAmount: Number(activeBooking.monthlyRent),
    }
  }

  const pastBookings = await Promise.all(
    pastBookingsRaw.map(async (booking) => {
      const building = await prisma.building.findUnique({
        where: { id: booking.buildingId },
        select: { name: true },
      })

      const bed = await prisma.bed.findUnique({
        where: { id: booking.bedId },
        select: { bedLabel: true },
      })

      const room = await prisma.room.findUnique({
        where: { id: booking.roomId },
        select: { roomNumber: true, type: true },
      })

      return {
        ...booking,
        monthlyRent: Number(booking.monthlyRent),
        depositAmount: Number(booking.depositAmount),
        building,
        bed,
        room,
      }
    })
  )

  return {
    activeBooking: activeBookingResult,
    pastBookings,
    pagination: buildPaginationMeta(page, limit, total),
  }
}

export async function getBookingByIdService(
  bookingId: string,
  userId: string,
  role: string
) {
  const tenantProfile =
    role === 'TENANT'
      ? await prisma.tenantProfile.findUnique({
          where: { userId },
          select: { id: true },
        })
      : null

  const ownerProfile =
    role === 'OWNER'
      ? await prisma.ownerProfile.findUnique({
          where: { userId },
          select: { id: true },
        })
      : null

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  })

  if (!booking) throw new NotFoundError('Booking not found')

  if (tenantProfile && booking.tenantId !== tenantProfile.id) {
    throw new ForbiddenError('Access denied')
  }

  if (ownerProfile && booking.ownerId !== ownerProfile.id) {
    throw new ForbiddenError('Access denied')
  }

  const tenant = await prisma.tenantProfile.findUnique({
    where: { id: booking.tenantId },
    select: { id: true, fullName: true },
  })

  const building = await prisma.building.findUnique({
    where: { id: booking.buildingId },
  })

  const room = await prisma.room.findUnique({
    where: { id: booking.roomId },
  })

  const bed = await prisma.bed.findUnique({
    where: { id: booking.bedId },
  })

  const payments = await prisma.payment.findMany({
    where: { bookingId: booking.id },
    orderBy: { createdAt: 'desc' },
  })

  return {
    ...booking,
    monthlyRent: Number(booking.monthlyRent),
    depositAmount: Number(booking.depositAmount),
    tenant,
    building,
    room,
    bed,
    payments: payments.map((p) => ({
      ...p,
      amountRupees: Number(p.amountRupees),
    })),
  }
}

export async function cancelBookingService(
  bookingId: string,
  userId: string,
  role: string,
  dto: CancelBookingDto
) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
  })

  if (!booking) throw new NotFoundError('Booking not found')

  const tenantProfile =
    role === 'TENANT'
      ? await prisma.tenantProfile.findUnique({
          where: { userId },
          select: { id: true },
        })
      : null

  const ownerProfile =
    role === 'OWNER'
      ? await prisma.ownerProfile.findUnique({
          where: { userId },
          select: { id: true },
        })
      : null

  if (tenantProfile && booking.tenantId !== tenantProfile.id) {
    throw new ForbiddenError('Access denied')
  }

  if (ownerProfile && booking.ownerId !== ownerProfile.id) {
    throw new ForbiddenError('Access denied')
  }

  if (booking.status === 'COMPLETED' || booking.status === 'CANCELLED') {
    throw new BadRequestError('This booking cannot be cancelled', 'INVALID_STATUS')
  }

  return prisma.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancellationReason: dto.reason,
      },
    })

    await tx.bed.update({
      where: { id: booking.bedId },
      data: { status: 'VACANT' },
    })

    await tx.tenantProfile.update({
      where: { id: booking.tenantId },
      data: { status: 'SEARCHING' },
    })

    return {
      bookingId,
      status: 'CANCELLED',
      bedStatus: 'VACANT',
    }
  })
}
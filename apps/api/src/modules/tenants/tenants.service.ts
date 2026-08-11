import { prisma } from '@config/prisma'
import { NotFoundError, BadRequestError } from '@utils/errors'
import { buildPaginationMeta } from '@utils/response.util'
import { parsePagination } from '@utils/pagination.util'

export async function getOwnerTenantsService(
  ownerId: string,
  query: Record<string, unknown>
) {
  const { page, limit, skip } = parsePagination(query)

  const bookings = await prisma.booking.findMany({
    where: {
      ownerId,
      status: 'CONFIRMED',
    },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit,
  })

  const total = await prisma.booking.count({
    where: {
      ownerId,
      status: 'CONFIRMED',
    },
  })

  const now = new Date()

  const items = await Promise.all(
    bookings.map(async (b) => {
      const tenant = await prisma.tenantProfile.findUnique({
        where: { id: b.tenantId },
      })

      const building = await prisma.building.findUnique({
        where: { id: b.buildingId },
        select: { id: true, name: true },
      })

      const room = await prisma.room.findUnique({
        where: { id: b.roomId },
        select: { id: true, roomNumber: true, type: true },
      })

      const bed = await prisma.bed.findUnique({
        where: { id: b.bedId },
        select: { id: true, bedLabel: true },
      })

      const payment = await prisma.payment.findFirst({
        where: {
          tenantId: b.tenantId,
          type: 'RENT',
          billingMonth: now.getMonth() + 1,
          billingYear: now.getFullYear(),
        },
        orderBy: { createdAt: 'desc' },
        select: {
          status: true,
          createdAt: true,
        },
      })

      return {
        id: tenant?.id ?? b.tenantId,
        fullName: tenant?.fullName ?? 'Unknown Tenant',
        gender: tenant?.gender ?? null,
        profession: tenant?.profession ?? null,
        phone: tenant?.phone ?? null,
        isIdVerified: tenant?.isIdVerified ?? false,
        status: tenant?.status ?? null,
        building,
        room,
        bed,
        monthlyRent: Number(b.monthlyRent),
        currentMonthPayment: payment
          ? {
              status: payment.status,
              paidAt: payment.createdAt,
            }
          : {
              status: 'PENDING',
              paidAt: null,
            },
      }
    })
  )

  return {
    items,
    pagination: buildPaginationMeta(page, limit, total),
  }
}

export async function getTenantDetailService(tenantId: string, ownerId: string) {
  const booking = await prisma.booking.findFirst({
    where: {
      tenantId,
      ownerId,
      status: 'CONFIRMED',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!booking) {
    throw new NotFoundError('Tenant not found')
  }

  const tenant = await prisma.tenantProfile.findUnique({
    where: { id: tenantId },
  })

  if (!tenant) {
    throw new NotFoundError('Tenant not found')
  }

  const user = await prisma.user.findUnique({
    where: { id: tenant.userId },
    select: {
      email: true,
    },
  })

  const building = await prisma.building.findUnique({
    where: { id: booking.buildingId },
    select: {
      id: true,
      name: true,
      addressLine1: true,
      city: true,
    },
  })

  const room = await prisma.room.findUnique({
    where: { id: booking.roomId },
    select: {
      id: true,
      roomNumber: true,
      type: true,
    },
  })

  const bed = await prisma.bed.findUnique({
    where: { id: booking.bedId },
    select: {
      id: true,
      bedLabel: true,
      monthlyRent: true,
    },
  })

  const payments = await prisma.payment.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      type: true,
      status: true,
      amountRupees: true,
      billingMonth: true,
      billingYear: true,
      receiptNumber: true,
      createdAt: true,
    },
  })

  const issues = await prisma.issue.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: {
      id: true,
      title: true,
      category: true,
      priority: true,
      status: true,
      createdAt: true,
    },
  })

  return {
    id: tenant.id,
    fullName: tenant.fullName,
    gender: tenant.gender,
    profession: tenant.profession,
    phone: tenant.phone,
    email: user?.email ?? null,
    dateOfBirth: tenant.dateOfBirth,
    employerOrCollege: tenant.employerOrCollege,
    emergencyName: tenant.emergencyName,
    emergencyPhone: tenant.emergencyPhone,
    emergencyRelation: tenant.emergencyRelation,
    isIdVerified: tenant.isIdVerified,
    status: tenant.status,
    city: tenant.city,
    booking: {
      id: booking.id,
      moveInDate: booking.moveInDate,
      monthlyRent: Number(booking.monthlyRent),
      depositAmount: Number(booking.depositAmount),
      building,
      room,
      bed: bed
        ? {
            ...bed,
            monthlyRent: Number(bed.monthlyRent),
          }
        : null,
    },
    recentPayments: payments.map((p) => ({
      ...p,
      amountRupees: Number(p.amountRupees),
    })),
    recentIssues: issues,
  }
}

export async function updateTenantNotesService(
  tenantId: string,
  ownerId: string,
  notes: string
) {
  const booking = await prisma.booking.findFirst({
    where: {
      tenantId,
      ownerId,
      status: 'CONFIRMED',
    },
    select: { id: true },
  })

  if (!booking) {
    throw new NotFoundError('Tenant not found')
  }

  return {
    tenantId,
    notes,
    saved: false,
    message: 'Owner notes field is not available in the current schema.',
  }
}
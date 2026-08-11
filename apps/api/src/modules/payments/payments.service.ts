import { prisma } from '@config/prisma'
import { env } from '@config/env'
import { RECEIPT } from '@config/constants'
import { BadRequestError, NotFoundError, ForbiddenError } from '@utils/errors'
import { logger } from '@utils/logger'
import { parsePagination } from '@utils/pagination.util'
import { buildPaginationMeta } from '@utils/response.util'

function generateReceiptNumber(): string {
  const now = new Date()
  const seq = String(Math.floor(Math.random() * 99999)).padStart(5, '0')
  return `${RECEIPT.PREFIX}-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${seq}`
}

// ─────────────────────────────────────────────────────────────
// Helper: build a UPI intent URI
// Works with GPay, PhonePe, Paytm, etc. on mobile
// ─────────────────────────────────────────────────────────────
function buildUpiIntentUrl(params: {
  payeeVpa: string
  payeeName: string
  amount: number
  transactionNote: string
}): string {
  const { payeeVpa, payeeName, amount, transactionNote } = params
  const encoded = new URLSearchParams({
    pa: payeeVpa,           // payee UPI VPA
    pn: payeeName,          // payee name
    am: amount.toFixed(2),  // amount
    cu: 'INR',              // currency
    tn: transactionNote,    // transaction note
  })
  return `upi://pay?${encoded.toString()}`
}

// ─────────────────────────────────────────────────────────────
// createPaymentOrder — tenant initiates rent payment via UPI
// ─────────────────────────────────────────────────────────────
export async function createPaymentOrderService(
  tenantUserId: string,
  dto: {
    bookingId: string
    type: 'RENT' | 'SECURITY_DEPOSIT'
    billingMonth?: number
    billingYear?: number
  }
) {
  const tenantProfile = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId }, select: { id: true, fullName: true },
  })
  if (!tenantProfile) throw new NotFoundError('Tenant profile not found')

  const booking = await prisma.booking.findFirst({
    where: { id: dto.bookingId, tenantId: tenantProfile.id, status: 'CONFIRMED' },
    include: {
      building: {
        select: {
          name: true, ownerId: true,
          owner: { select: { id: true, fullName: true, upiId: true, businessName: true } },
        },
      },
    },
  })
  if (!booking) throw new NotFoundError('Active booking not found')

  const ownerUpiId = booking.building.owner.upiId
  if (!ownerUpiId) {
    throw new BadRequestError(
      'Property owner has not set up their UPI ID yet. Please contact them.',
      'OWNER_UPI_NOT_SET'
    )
  }

  let amountRupees: number
  let description: string

  if (dto.type === 'RENT') {
    if (!dto.billingMonth || !dto.billingYear) {
      throw new BadRequestError('billingMonth and billingYear are required for rent payments')
    }

    // Check if already paid for this period
    const existing = await prisma.payment.findFirst({
      where: {
        bookingId:    dto.bookingId,
        type:         'RENT',
        billingMonth: dto.billingMonth,
        billingYear:  dto.billingYear,
        status:       'SUCCESS',
      },
    })
    if (existing) {
      throw new BadRequestError(
        `Rent for ${dto.billingMonth}/${dto.billingYear} has already been paid.`,
        'ALREADY_PAID'
      )
    }

    amountRupees = Number(booking.monthlyRent)
    description = `Rent for ${dto.billingMonth}/${dto.billingYear}`
  } else {
    if (booking.depositPaid) {
      throw new BadRequestError('Security deposit has already been paid.', 'ALREADY_PAID')
    }
    amountRupees = Number(booking.depositAmount)
    description  = 'Security deposit'
  }

  const payment = await prisma.payment.create({
    data: {
      bookingId:      dto.bookingId,
      tenantId:       tenantProfile.id,
      ownerId:        booking.building.owner.id,
      buildingId:     booking.buildingId,
      type:           dto.type,
      status:         'PENDING',
      amountRupees,
      billingMonth:   dto.billingMonth,
      billingYear:    dto.billingYear,
    },
  })

  const payeeName = booking.building.owner.businessName || booking.building.owner.fullName
  const upiIntentUrl = buildUpiIntentUrl({
    payeeVpa:        ownerUpiId,
    payeeName,
    amount:          amountRupees,
    transactionNote: `${booking.building.name} - ${description}`,
  })

  return {
    paymentId:    payment.id,
    amountRupees,
    currency:     'INR',
    type:         dto.type,
    billingMonth: dto.billingMonth,
    billingYear:  dto.billingYear,
    description,
    upiIntentUrl,
    payeeUpiId:   ownerUpiId,
    payeeName,
  }
}

// ─────────────────────────────────────────────────────────────
// submitUpiReference — tenant submits their UTR / transaction ID
// ─────────────────────────────────────────────────────────────
export async function submitUpiReferenceService(
  paymentId: string,
  tenantUserId: string,
  dto: { upiTransactionId: string }
) {
  const tenantProfile = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId }, select: { id: true },
  })
  if (!tenantProfile) throw new NotFoundError('Tenant profile not found')

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, tenantId: tenantProfile.id, status: 'PENDING' },
  })
  if (!payment) throw new NotFoundError('Pending payment not found')

  await prisma.payment.update({
    where: { id: paymentId },
    data: { upiTransactionId: dto.upiTransactionId },
  })

  return { paymentId, upiTransactionId: dto.upiTransactionId }
}

// ─────────────────────────────────────────────────────────────
// confirmPayment — owner confirms a pending payment was received
// ─────────────────────────────────────────────────────────────
export async function confirmPaymentService(
  paymentId: string,
  ownerUserId: string
) {
  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { userId: ownerUserId }, select: { id: true },
  })
  if (!ownerProfile) throw new NotFoundError('Owner profile not found')

  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, ownerId: ownerProfile.id, status: 'PENDING' },
  })
  if (!payment) throw new NotFoundError('Pending payment not found for this owner')

  const receiptNumber = generateReceiptNumber()

  await prisma.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status:             'SUCCESS',
        confirmedByOwnerId: ownerProfile.id,
        confirmedAt:        new Date(),
        receiptNumber,
      },
    })

    // Handle security deposit
    if (payment.type === 'SECURITY_DEPOSIT') {
      await tx.booking.update({
        where: { id: payment.bookingId },
        data:  { depositPaid: true },
      })
    }
  })

  logger.info(`Payment ${payment.id} confirmed by owner: ${receiptNumber}`, 'PaymentConfirm')

  return { paymentId, status: 'SUCCESS', receiptNumber }
}

// ─────────────────────────────────────────────────────────────
// getMyPayments — tenant payment history
// ─────────────────────────────────────────────────────────────
export async function getMyPaymentsService(tenantUserId: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query)
  const tenantProfile = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId }, select: { id: true },
  })
  if (!tenantProfile) throw new NotFoundError('Tenant profile not found')

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where:   { tenantId: tenantProfile.id },
      skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: { building: { select: { name: true } } },
    }),
    prisma.payment.count({ where: { tenantId: tenantProfile.id } }),
  ])

  const totalPaid = await prisma.payment.aggregate({
    where:  { tenantId: tenantProfile.id, status: 'SUCCESS' },
    _sum:   { amountRupees: true },
  })

  return {
    items:      payments,
    pagination: buildPaginationMeta(page, limit, total),
    summary: {
      totalPaid:     Number(totalPaid._sum.amountRupees ?? 0),
    },
  }
}

export async function getReceiptService(paymentId: string, tenantUserId: string) {
  const tenantProfile = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId }, select: { id: true },
  })
  if (!tenantProfile) throw new NotFoundError('Tenant profile not found')

  const payment = await prisma.payment.findFirst({
    where:   { id: paymentId, tenantId: tenantProfile.id, status: 'SUCCESS' },
    include: {
      building: { select: { name: true, addressLine1: true } },
      tenant:   { select: { fullName: true } },
      owner:    { select: { fullName: true, businessName: true } },
    },
  })
  if (!payment) throw new NotFoundError('Receipt not found')
  return payment
}

export async function getOwnerPaymentsService(ownerId: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query)
  const { buildingId, status, type, tenantId } = query as Record<string, string>

  const where = {
    ownerId,
    ...(buildingId && { buildingId }),
    ...(status && { status: status as never }),
    ...(type && { type: type as never }),
    ...(tenantId && { tenantId }),
  }

  const [paymentsRaw, total, summary] = await Promise.all([
    prisma.payment.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, fullName: true, phone: true } },
        building: { select: { name: true } },
        booking: {
          select: {
            roomId: true,
            bedId: true,
          },
        },
      },
    }),
    prisma.payment.count({ where }),
    prisma.payment.aggregate({
      where: { ownerId, status: 'SUCCESS' },
      _sum: { amountRupees: true },
    }),
  ])

  const payments = await Promise.all(
    paymentsRaw.map(async (payment) => {
      let room: { roomNumber: string } | null = null
      let bed: { bedLabel: string } | null = null

      if (payment.booking?.roomId) {
        room = await prisma.room.findUnique({
          where: { id: payment.booking.roomId },
          select: { roomNumber: true },
        })
      }

      if (payment.booking?.bedId) {
        bed = await prisma.bed.findUnique({
          where: { id: payment.booking.bedId },
          select: { bedLabel: true },
        })
      }

      return {
        ...payment,
        amountRupees: Number(payment.amountRupees),
        booking: payment.booking
          ? {
              room,
              bed,
            }
          : null,
      }
    })
  )

  return {
    items: payments,
    pagination: buildPaginationMeta(page, limit, total),
    summary: {
      totalCollected: Number(summary._sum.amountRupees ?? 0),
    },
  }
}
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

  // PENDING is allowed on purpose: a self-service booking starts PENDING and is
  // confirmed by paying the deposit. Requiring CONFIRMED here deadlocked the
  // flow — the tenant could not pay, and nothing else moved the booking on.
  const booking = await prisma.booking.findFirst({
    where: {
      id:       dto.bookingId,
      tenantId: tenantProfile.id,
      status:   { in: ['PENDING', 'CONFIRMED'] },
    },
    include: {
      building: {
        select: {
          name: true, ownerId: true,
          owner: { select: { 
            id: true, fullName: true, upiId: true, businessName: true,
            bankName: true, bankAccountName: true, bankAccountNumber: true, bankIfscCode: true
          } },
        },
      },
    },
  })
  if (!booking) throw new NotFoundError('Active booking not found')

  const owner = booking.building.owner
  const ownerUpiId = owner.upiId
  const hasBankDetails = owner.bankAccountNumber && owner.bankIfscCode
  if (!ownerUpiId && !hasBankDetails) {
    throw new BadRequestError(
      'Property owner has not set up their payment details yet. Please contact them.',
      'OWNER_PAYMENT_NOT_SET'
    )
  }

  let amountRupees: number
  let description: string

  if (dto.type === 'RENT' && booking.status !== 'CONFIRMED') {
    throw new BadRequestError(
      'Pay the security deposit first — that confirms your booking.',
      'DEPOSIT_NOT_PAID'
    )
  }

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
    payeeVpa:        ownerUpiId || '',
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
    upiIntentUrl: ownerUpiId ? upiIntentUrl : null,
    payeeUpiId:   ownerUpiId,
    payeeName,
    bankDetails: {
      bankName:          booking.building.owner.bankName,
      bankAccountName:   booking.building.owner.bankAccountName,
      bankAccountNumber: booking.building.owner.bankAccountNumber,
      bankIfscCode:      booking.building.owner.bankIfscCode,
    }
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

    // Confirming the deposit is what turns a self-service booking into a real
    // tenancy. This mirrors assignBedService, which is the owner-driven path to
    // the same end state. Previously only depositPaid was set, so the booking
    // stayed PENDING for ever and the bed stayed RESERVED.
    if (payment.type === 'SECURITY_DEPOSIT') {
      const booking = await tx.booking.update({
        where: { id: payment.bookingId },
        data:  { depositPaid: true, status: 'CONFIRMED' },
      })

      await tx.bed.update({
        where: { id: booking.bedId },
        data:  { status: 'OCCUPIED', currentTenantId: booking.tenantId },
      })

      await tx.tenantProfile.update({
        where: { id: booking.tenantId },
        data:  { status: 'ACTIVE' },
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

  const [totalPaid, totalPending] = await Promise.all([
    prisma.payment.aggregate({
      where: { tenantId: tenantProfile.id, status: 'SUCCESS' },
      _sum:  { amountRupees: true },
    }),
    // A UPI payment sits PENDING until the owner confirms the reference, so
    // without this the money a tenant has already sent is invisible to them.
    prisma.payment.aggregate({
      where: { tenantId: tenantProfile.id, status: 'PENDING' },
      _sum:  { amountRupees: true },
    }),
  ])

  return {
    items:      payments,
    pagination: buildPaginationMeta(page, limit, total),
    summary: {
      totalPaid:        Number(totalPaid._sum.amountRupees ?? 0),
      totalPending:     Number(totalPending._sum.amountRupees ?? 0),
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

  const [paymentsRaw, total, summary, pending] = await Promise.all([
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
    // The owner page renders summary.pendingAmount, which was never returned —
    // "Pending" always read as zero however many payments awaited confirmation.
    prisma.payment.aggregate({
      where: { ownerId, status: 'PENDING' },
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
      pendingAmount:  Number(pending._sum.amountRupees ?? 0),
    },
  }
}
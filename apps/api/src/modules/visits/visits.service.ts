import { prisma } from '@config/prisma'
import { BadRequestError, ForbiddenError, NotFoundError } from '@utils/errors'

/**
 * Visit requests — a tenant asking to see a property before committing to it.
 *
 * Deliberately unrelated to Booking: a visit reserves nothing, holds no bed and
 * most never become a booking. Keeping them separate means a browsing tenant
 * cannot accidentally block inventory.
 */

/** Stops a tenant from spamming one owner with open requests. */
const MAX_OPEN_REQUESTS_PER_TENANT = 5

async function tenantProfileFor(userId: string) {
  const profile = await prisma.tenantProfile.findUnique({
    where: { userId }, select: { id: true },
  })
  if (!profile) throw new NotFoundError('Tenant profile not found')
  return profile
}

export async function requestVisitService(
  tenantUserId: string,
  dto: { buildingId: string; requestedAt: string; tenantNote?: string }
) {
  const tenant = await tenantProfileFor(tenantUserId)

  const building = await prisma.building.findFirst({
    where:  { id: dto.buildingId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, ownerId: true, name: true },
  })
  // Same message whether the building is missing or simply not listed — a
  // browsing tenant has no business learning about inactive properties.
  if (!building) throw new NotFoundError('Property not found')

  const when = new Date(dto.requestedAt)
  if (Number.isNaN(when.getTime())) {
    throw new BadRequestError('Invalid visit date', 'INVALID_DATE')
  }
  if (when.getTime() < Date.now()) {
    throw new BadRequestError('Pick a time in the future', 'DATE_IN_PAST')
  }

  const alreadyOpen = await prisma.visitRequest.findFirst({
    where: {
      tenantId:   tenant.id,
      buildingId: dto.buildingId,
      status:     { in: ['REQUESTED', 'CONFIRMED'] },
    },
    select: { id: true },
  })
  if (alreadyOpen) {
    throw new BadRequestError(
      'You already have a visit pending for this property.',
      'VISIT_ALREADY_REQUESTED'
    )
  }

  const openCount = await prisma.visitRequest.count({
    where: { tenantId: tenant.id, status: { in: ['REQUESTED', 'CONFIRMED'] } },
  })
  if (openCount >= MAX_OPEN_REQUESTS_PER_TENANT) {
    throw new BadRequestError(
      `You can have at most ${MAX_OPEN_REQUESTS_PER_TENANT} visits pending at once.`,
      'TOO_MANY_VISITS'
    )
  }

  const visit = await prisma.visitRequest.create({
    data: {
      tenantId:    tenant.id,
      buildingId:  building.id,
      ownerId:     building.ownerId,
      requestedAt: when,
      tenantNote:  dto.tenantNote,
    },
    select: { id: true, status: true, requestedAt: true },
  })

  return { ...visit, buildingName: building.name }
}

export async function getMyVisitsService(tenantUserId: string) {
  const tenant = await tenantProfileFor(tenantUserId)

  const visits = await prisma.visitRequest.findMany({
    where:   { tenantId: tenant.id },
    orderBy: { requestedAt: 'desc' },
    take:    50,
    include: {
      building: { select: { id: true, name: true, addressLine1: true, city: true, contactPhone: true } },
    },
  })

  return { visits }
}

export async function getOwnerVisitsService(ownerId: string) {
  const visits = await prisma.visitRequest.findMany({
    where:   { ownerId },
    orderBy: [{ status: 'asc' }, { requestedAt: 'asc' }],
    take:    100,
    include: {
      building: { select: { id: true, name: true } },
      tenant:   { select: { id: true, fullName: true, phone: true, isIdVerified: true } },
    },
  })

  return { visits }
}

/**
 * Owner responds. Confirming may move the slot — owners rarely have the exact
 * time free — so the agreed time is stored separately from the requested one.
 */
export async function respondToVisitService(
  visitId: string,
  ownerId: string,
  dto: { action: 'CONFIRM' | 'DECLINE'; confirmedAt?: string; ownerNote?: string }
) {
  const visit = await prisma.visitRequest.findFirst({
    where:  { id: visitId, ownerId },
    select: { id: true, status: true, requestedAt: true },
  })
  if (!visit) throw new NotFoundError('Visit request not found')

  if (visit.status !== 'REQUESTED') {
    throw new BadRequestError(
      `This visit is already ${visit.status.toLowerCase()}.`,
      'INVALID_STATUS'
    )
  }

  if (dto.action === 'DECLINE') {
    return prisma.visitRequest.update({
      where:  { id: visitId },
      data:   { status: 'DECLINED', ownerNote: dto.ownerNote },
      select: { id: true, status: true },
    })
  }

  const confirmedAt = dto.confirmedAt ? new Date(dto.confirmedAt) : visit.requestedAt
  if (Number.isNaN(confirmedAt.getTime())) {
    throw new BadRequestError('Invalid visit date', 'INVALID_DATE')
  }

  return prisma.visitRequest.update({
    where:  { id: visitId },
    data:   { status: 'CONFIRMED', confirmedAt, ownerNote: dto.ownerNote },
    select: { id: true, status: true, confirmedAt: true },
  })
}

/** Either side can call off a visit that has not happened yet. */
export async function cancelVisitService(
  visitId: string,
  userId: string,
  role: 'TENANT' | 'OWNER'
) {
  const visit = await prisma.visitRequest.findUnique({
    where:  { id: visitId },
    select: { id: true, status: true, tenantId: true, ownerId: true },
  })
  if (!visit) throw new NotFoundError('Visit request not found')

  if (role === 'TENANT') {
    const tenant = await tenantProfileFor(userId)
    if (visit.tenantId !== tenant.id) throw new ForbiddenError('Access denied')
  } else {
    const owner = await prisma.ownerProfile.findUnique({
      where: { userId }, select: { id: true },
    })
    if (!owner || visit.ownerId !== owner.id) throw new ForbiddenError('Access denied')
  }

  if (visit.status === 'CANCELLED' || visit.status === 'COMPLETED') {
    throw new BadRequestError('This visit can no longer be cancelled', 'INVALID_STATUS')
  }

  return prisma.visitRequest.update({
    where:  { id: visitId },
    data:   { status: 'CANCELLED' },
    select: { id: true, status: true },
  })
}

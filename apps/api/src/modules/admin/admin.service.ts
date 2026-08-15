import { prisma } from '@config/prisma'
import { NotFoundError, BadRequestError } from '@utils/errors'

export async function getPendingOwnersService() {
  const owners = await prisma.ownerProfile.findMany({
    where: { verificationStatus: 'UNDER_REVIEW' },
    include: {
      user:      { select: { email: true, createdAt: true } },
      documents: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'asc' },
  })
  return { owners }
}

export async function approveOwnerService(ownerProfileId: string, adminUserId: string, notes?: string) {
  const owner = await prisma.ownerProfile.findUnique({ where: { id: ownerProfileId } })
  if (!owner) throw new NotFoundError('Owner profile not found')
  if (owner.verificationStatus !== 'UNDER_REVIEW') {
    throw new BadRequestError('Owner is not under review', 'INVALID_STATUS')
  }

  await prisma.$transaction([
    prisma.ownerProfile.update({
      where: { id: ownerProfileId },
      data: {
        verificationStatus: 'VERIFIED',
        verifiedAt:         new Date(),
        verifiedBy:         adminUserId,
        verificationNotes:  notes ?? null,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId:    adminUserId,
        actorRole:  'SUPER_ADMIN',
        action:     'OWNER_VERIFIED',
        entityType: 'owner_profiles',
        entityId:   ownerProfileId,
        metadata:   { notes: notes ?? '' },
      },
    }),
  ])

  // TODO Phase 10: Send approval email via Resend
  return { verificationStatus: 'VERIFIED' }
}

export async function rejectOwnerService(ownerProfileId: string, adminUserId: string, reason: string) {
  const owner = await prisma.ownerProfile.findUnique({ where: { id: ownerProfileId } })
  if (!owner) throw new NotFoundError('Owner profile not found')

  await prisma.$transaction([
    prisma.ownerProfile.update({
      where: { id: ownerProfileId },
      data:  { verificationStatus: 'REJECTED', verificationNotes: reason },
    }),
    prisma.auditLog.create({
      data: {
        actorId:    adminUserId,
        actorRole:  'SUPER_ADMIN',
        action:     'OWNER_REJECTED',
        entityType: 'owner_profiles',
        entityId:   ownerProfileId,
        metadata:   { reason },
      },
    }),
  ])

  return { verificationStatus: 'REJECTED' }
}
// ─────────────────────────────────────────────────────────────
// Tenant identity verification
//
// tenantProfile.isIdVerified gates both booking (bookings.service.ts) and bed
// assignment (beds.service.ts), but nothing in the codebase ever set it — a
// tenant who uploaded an Aadhaar had no way to become verified, so no booking
// could ever be made. These are the missing write paths.
// ─────────────────────────────────────────────────────────────

/** Tenants who have uploaded an identity document but are not yet verified. */
export async function getPendingTenantsService() {
  const tenants = await prisma.tenantProfile.findMany({
    where: {
      isIdVerified: false,
      documents:    { some: {} },
    },
    include: {
      user:      { select: { email: true, createdAt: true } },
      documents: {
        select: { id: true, documentType: true, fileName: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  return { tenants }
}

export async function verifyTenantIdService(
  tenantProfileId: string,
  adminUserId: string,
  notes?: string
) {
  const tenant = await prisma.tenantProfile.findUnique({ where: { id: tenantProfileId } })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  if (tenant.isIdVerified) {
    throw new BadRequestError('This tenant is already verified', 'ALREADY_VERIFIED')
  }

  const documentCount = await prisma.tenantDocument.count({ where: { tenantId: tenantProfileId } })
  if (documentCount === 0) {
    throw new BadRequestError(
      'This tenant has not uploaded an identity document yet',
      'NO_DOCUMENTS'
    )
  }

  await prisma.$transaction([
    prisma.tenantProfile.update({
      where: { id: tenantProfileId },
      data:  { isIdVerified: true, idVerifiedAt: new Date() },
    }),
    prisma.tenantDocument.updateMany({
      where: { tenantId: tenantProfileId },
      data:  {
        status:      'VERIFIED',
        reviewedAt:  new Date(),
        reviewedBy:  adminUserId,
        reviewNotes: notes ?? null,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId:    adminUserId,
        actorRole:  'SUPER_ADMIN',
        action:     'DOCUMENT_VERIFIED',
        entityType: 'tenant_profiles',
        entityId:   tenantProfileId,
        metadata:   { notes: notes ?? '' },
      },
    }),
  ])

  return { isIdVerified: true }
}

export async function rejectTenantIdService(
  tenantProfileId: string,
  adminUserId: string,
  reason: string
) {
  const tenant = await prisma.tenantProfile.findUnique({ where: { id: tenantProfileId } })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  // isIdVerified stays false; the documents carry the reason so the tenant can
  // see why and upload a replacement.
  await prisma.$transaction([
    prisma.tenantDocument.updateMany({
      where: { tenantId: tenantProfileId },
      data:  {
        status:      'REJECTED',
        reviewedAt:  new Date(),
        reviewedBy:  adminUserId,
        reviewNotes: reason,
      },
    }),
    prisma.auditLog.create({
      data: {
        actorId:    adminUserId,
        actorRole:  'SUPER_ADMIN',
        action:     'DOCUMENT_VERIFIED',
        entityType: 'tenant_profiles',
        entityId:   tenantProfileId,
        metadata:   { rejected: true, reason },
      },
    }),
  ])

  return { isIdVerified: false }
}

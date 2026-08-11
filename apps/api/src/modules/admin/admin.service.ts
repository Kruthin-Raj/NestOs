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
import { prisma } from '@config/prisma'
import { env } from '@config/env'
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '@utils/errors'
import { Prisma, UserRole, UserStatus, RejectionType } from '@prisma/client'
import { ListUsersQueryDto, UpdateUserStatusDto, UpdateUserRoleDto } from './admin.validation'

// ─────────────────────────────────────────────────────────────
// Owner Verification Queue
// ─────────────────────────────────────────────────────────────

export async function getPendingOwnersService() {
  const owners = await prisma.ownerProfile.findMany({
    where: { verificationStatus: 'UNDER_REVIEW' },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          rejectionCount: true,
          createdAt: true,
          rejections: {
            where: { targetType: 'OWNER_VERIFICATION' },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
      },
      documents: { orderBy: { createdAt: 'desc' } },
    },
    orderBy: { createdAt: 'asc' },
  })

  const enrichedOwners = owners.map((owner) => ({
    ...owner,
    isFlagged: owner.user.rejectionCount >= env.REJECTION_FLAG_THRESHOLD,
    lastRejectionReason: owner.user.rejections[0]?.reason ?? null,
  }))

  return { owners: enrichedOwners }
}

export async function approveOwnerService(ownerProfileId: string, adminUserId: string, notes?: string) {
  const owner = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    include: { user: true },
  })
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

  return { verificationStatus: 'VERIFIED' }
}

export async function rejectOwnerService(ownerProfileId: string, adminUserId: string, reason: string) {
  const owner = await prisma.ownerProfile.findUnique({
    where: { id: ownerProfileId },
    include: { user: true },
  })
  if (!owner) throw new NotFoundError('Owner profile not found')

  await prisma.$transaction([
    prisma.ownerProfile.update({
      where: { id: ownerProfileId },
      data:  { verificationStatus: 'REJECTED', verificationNotes: reason },
    }),
    prisma.user.update({
      where: { id: owner.userId },
      data: {
        rejectionCount: { increment: 1 },
      },
    }),
    prisma.userRejection.create({
      data: {
        userId:     owner.userId,
        targetType: 'OWNER_VERIFICATION',
        reason,
        adminId:    adminUserId,
      },
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

  const updatedUser = await prisma.user.findUnique({
    where: { id: owner.userId },
    select: { rejectionCount: true },
  })

  return {
    verificationStatus: 'REJECTED',
    rejectionCount: updatedUser?.rejectionCount ?? 0,
    isFlagged: (updatedUser?.rejectionCount ?? 0) >= env.REJECTION_FLAG_THRESHOLD,
  }
}

// ─────────────────────────────────────────────────────────────
// Tenant Identity Verification Queue
// ─────────────────────────────────────────────────────────────

export async function getPendingTenantsService() {
  const tenants = await prisma.tenantProfile.findMany({
    where: {
      isIdVerified: false,
      documents:    { some: { status: { not: 'REJECTED' } } },
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          phone: true,
          status: true,
          rejectionCount: true,
          createdAt: true,
          rejections: {
            where: { targetType: 'TENANT_IDENTITY' },
            orderBy: { createdAt: 'desc' },
            take: 3,
          },
        },
      },
      documents: {
        select: { id: true, documentType: true, fileName: true, fileUrl: true, status: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  })

  const enrichedTenants = tenants.map((tenant) => ({
    ...tenant,
    isFlagged: tenant.user.rejectionCount >= env.REJECTION_FLAG_THRESHOLD,
    lastRejectionReason: tenant.user.rejections[0]?.reason ?? null,
  }))

  return { tenants: enrichedTenants }
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
  const tenant = await prisma.tenantProfile.findUnique({
    where: { id: tenantProfileId },
    include: { user: true },
  })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

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
    prisma.user.update({
      where: { id: tenant.userId },
      data: {
        rejectionCount: { increment: 1 },
      },
    }),
    prisma.userRejection.create({
      data: {
        userId:     tenant.userId,
        targetType: 'TENANT_IDENTITY',
        reason,
        adminId:    adminUserId,
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

  const updatedUser = await prisma.user.findUnique({
    where: { id: tenant.userId },
    select: { rejectionCount: true },
  })

  return {
    isIdVerified: false,
    rejectionCount: updatedUser?.rejectionCount ?? 0,
    isFlagged: (updatedUser?.rejectionCount ?? 0) >= env.REJECTION_FLAG_THRESHOLD,
  }
}

// ─────────────────────────────────────────────────────────────
// User Management Module
// ─────────────────────────────────────────────────────────────

export async function listUsersService(query: ListUsersQueryDto) {
  const { page, limit, search, role, status, isFlagged, sortBy, sortOrder } = query
  const skip = (page - 1) * limit

  const where: Prisma.UserWhereInput = {
    deletedAt: null,
  }

  if (role) {
    where.role = role
  }

  if (status) {
    where.status = status
  }

  if (isFlagged !== undefined) {
    if (isFlagged) {
      where.rejectionCount = { gte: env.REJECTION_FLAG_THRESHOLD }
    } else {
      where.rejectionCount = { lt: env.REJECTION_FLAG_THRESHOLD }
    }
  }

  if (search) {
    where.OR = [
      { email: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search, mode: 'insensitive' } },
      { ownerProfile: { fullName: { contains: search, mode: 'insensitive' } } },
      { ownerProfile: { businessName: { contains: search, mode: 'insensitive' } } },
      { tenantProfile: { fullName: { contains: search, mode: 'insensitive' } } },
    ]
  }

  const orderBy: Prisma.UserOrderByWithRelationInput = {
    [sortBy]: sortOrder,
  }

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id:              true,
        email:           true,
        phone:           true,
        role:            true,
        status:          true,
        statusReason:    true,
        statusUpdatedAt: true,
        statusUpdatedBy: true,
        rejectionCount:  true,
        isEmailVerified: true,
        lastLoginAt:     true,
        createdAt:       true,
        ownerProfile: {
          select: {
            id:                 true,
            fullName:           true,
            businessName:       true,
            verificationStatus: true,
          },
        },
        tenantProfile: {
          select: {
            id:                true,
            fullName:          true,
            status:            true,
            isIdVerified:      true,
            profileCompletion: true,
          },
        },
      },
    }),
  ])

  const enrichedUsers = users.map((u) => ({
    ...u,
    isFlagged: u.rejectionCount >= env.REJECTION_FLAG_THRESHOLD,
    displayName: u.ownerProfile?.fullName || u.tenantProfile?.fullName || u.email.split('@')[0],
  }))

  return {
    users: enrichedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    flagThreshold: env.REJECTION_FLAG_THRESHOLD,
  }
}

export async function getUserDetailService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      ownerProfile: {
        include: {
          documents: { orderBy: { createdAt: 'desc' } },
          _count: { select: { buildings: true } },
        },
      },
      tenantProfile: {
        include: {
          documents: { orderBy: { createdAt: 'desc' } },
          preferences: true,
          currentBed: {
            include: {
              room: { select: { roomNumber: true, building: { select: { name: true, city: true } } } },
            },
          },
          _count: { select: { bookings: true, payments: true, issues: true } },
        },
      },
      rejections: {
        orderBy: { createdAt: 'desc' },
      },
      reportsReceived: {
        orderBy: { createdAt: 'desc' },
      },
      reportsSubmitted: {
        orderBy: { createdAt: 'desc' },
      },
      auditLogs: {
        take: 15,
        orderBy: { createdAt: 'desc' },
      },
    },
  })

  if (!user) throw new NotFoundError('User not found')

  return {
    user: {
      id:              user.id,
      email:           user.email,
      phone:           user.phone,
      role:            user.role,
      status:          user.status,
      statusReason:    user.statusReason,
      statusUpdatedAt: user.statusUpdatedAt,
      statusUpdatedBy: user.statusUpdatedBy,
      rejectionCount:  user.rejectionCount,
      isFlagged:       user.rejectionCount >= env.REJECTION_FLAG_THRESHOLD,
      isEmailVerified: user.isEmailVerified,
      isPhoneVerified: user.isPhoneVerified,
      lastLoginAt:     user.lastLoginAt,
      createdAt:       user.createdAt,
      updatedAt:       user.updatedAt,
      deletedAt:       user.deletedAt,
    },
    ownerProfile: user.ownerProfile,
    tenantProfile: user.tenantProfile,
    rejections: user.rejections,
    reportsReceived: user.reportsReceived,
    reportsSubmitted: user.reportsSubmitted,
    recentAuditLogs: user.auditLogs,
  }
}

export async function updateUserStatusService(
  userId: string,
  adminUserId: string,
  dto: UpdateUserStatusDto
) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt) throw new NotFoundError('User not found')

  if (userId === adminUserId && dto.status !== UserStatus.ACTIVE) {
    throw new BadRequestError('You cannot suspend, deactivate, or block your own admin account.')
  }

  const previousStatus = user.status

  await prisma.$transaction(async (tx) => {
    // If status is non-ACTIVE, bump tokenVersion to immediately kill all live JWTs and revoke refresh tokens
    const shouldRevokeSessions = dto.status !== UserStatus.ACTIVE

    await tx.user.update({
      where: { id: userId },
      data: {
        status:          dto.status,
        statusReason:    dto.reason ?? null,
        statusUpdatedAt: new Date(),
        statusUpdatedBy: adminUserId,
        ...(shouldRevokeSessions ? { tokenVersion: { increment: 1 } } : {}),
      },
    })

    if (shouldRevokeSessions) {
      await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data:  { revokedAt: new Date() },
      })
    }

    let action: 'USER_STATUS_CHANGED' | 'USER_BLOCKED' | 'USER_UNBLOCKED' | 'USER_SUSPENDED' | 'USER_DEACTIVATED' = 'USER_STATUS_CHANGED'
    if (dto.status === UserStatus.BLOCKED) action = 'USER_BLOCKED'
    else if (dto.status === UserStatus.SUSPENDED) action = 'USER_SUSPENDED'
    else if (dto.status === UserStatus.DEACTIVATED) action = 'USER_DEACTIVATED'
    else if (previousStatus === UserStatus.BLOCKED && dto.status === UserStatus.ACTIVE) action = 'USER_UNBLOCKED'

    await tx.auditLog.create({
      data: {
        actorId:    adminUserId,
        actorRole:  'SUPER_ADMIN',
        action,
        entityType: 'users',
        entityId:   userId,
        metadata:   { previousStatus, newStatus: dto.status, reason: dto.reason ?? '' },
      },
    })
  })

  return { status: dto.status, previousStatus }
}

export async function updateUserRoleService(
  userId: string,
  adminUserId: string,
  dto: UpdateUserRoleDto
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      ownerProfile: {
        include: {
          buildings: { where: { deletedAt: null } },
        },
      },
      tenantProfile: {
        include: {
          bookings: { where: { status: { in: ['CONFIRMED', 'PENDING'] } } },
          currentBed: true,
        },
      },
    },
  })

  if (!user || user.deletedAt) throw new NotFoundError('User not found')

  if (user.role === dto.role) {
    throw new BadRequestError(`User is already ${dto.role}`)
  }

  const previousRole = user.role

  // Validate Owner -> Tenant / Admin
  if (user.role === UserRole.OWNER && dto.role !== UserRole.OWNER) {
    const activeBuildingsCount = user.ownerProfile?.buildings.length ?? 0
    if (activeBuildingsCount > 0 && !dto.force) {
      throw new ConflictError(
        `This owner manages ${activeBuildingsCount} active property/properties. Archive or transfer them first, or pass force: true to automatically set them inactive.`,
        'OWNER_HAS_ACTIVE_BUILDINGS'
      )
    }
  }

  // Validate Tenant -> Owner / Admin
  if (user.role === UserRole.TENANT && dto.role !== UserRole.TENANT) {
    const activeBookingsCount = user.tenantProfile?.bookings.length ?? 0
    const hasBed = !!user.tenantProfile?.currentBed
    if ((activeBookingsCount > 0 || hasBed) && !dto.force) {
      throw new ConflictError(
        'This tenant has active bookings or assigned beds. Complete or cancel them first, or pass force: true.',
        'TENANT_HAS_ACTIVE_BOOKINGS'
      )
    }
  }

  await prisma.$transaction(async (tx) => {
    // Force cleanup if needed
    if (user.role === UserRole.OWNER && dto.force && user.ownerProfile) {
      await tx.building.updateMany({
        where: { ownerId: user.ownerProfile.id, deletedAt: null },
        data:  { status: 'INACTIVE' },
      })
    }

    if (user.role === UserRole.TENANT && dto.force && user.tenantProfile) {
      await tx.booking.updateMany({
        where: { tenantId: user.tenantProfile.id, status: 'PENDING' },
        data:  { status: 'CANCELLED', cancellationReason: 'Role changed by admin' },
      })
    }

    // Ensure target profile exists
    if (dto.role === UserRole.OWNER && !user.ownerProfile) {
      await tx.ownerProfile.create({
        data: {
          userId: user.id,
          fullName: user.tenantProfile?.fullName || '',
          verificationStatus: 'PENDING',
        },
      })
    } else if (dto.role === UserRole.TENANT && !user.tenantProfile) {
      await tx.tenantProfile.create({
        data: {
          userId: user.id,
          fullName: user.ownerProfile?.fullName || '',
          status: 'ONBOARDING',
        },
      })
    }

    // Update user role, bump tokenVersion to refresh claims, revoke refresh tokens
    await tx.user.update({
      where: { id: userId },
      data: {
        role:         dto.role,
        tokenVersion: { increment: 1 },
      },
    })

    await tx.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    })

    await tx.auditLog.create({
      data: {
        actorId:    adminUserId,
        actorRole:  'SUPER_ADMIN',
        action:     'USER_ROLE_CHANGED',
        entityType: 'users',
        entityId:   userId,
        metadata:   { previousRole, newRole: dto.role, reason: dto.reason ?? '', forced: dto.force },
      },
    })
  })

  return { role: dto.role, previousRole }
}

export async function deleteUserService(userId: string, adminUserId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user || user.deletedAt) throw new NotFoundError('User not found')

  if (userId === adminUserId) {
    throw new BadRequestError('You cannot delete your own admin account.')
  }

  const timestamp = Date.now()
  const scrambledEmail = `${user.email}__deleted__${timestamp}`
  const scrambledPhone = user.phone ? `${user.phone}__deleted__${timestamp}` : null

  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        email:        scrambledEmail,
        phone:        scrambledPhone,
        status:       UserStatus.DEACTIVATED,
        statusReason: 'Account deleted by administrator',
        deletedAt:    new Date(),
        tokenVersion: { increment: 1 },
      },
    }),
    prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data:  { revokedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorId:    adminUserId,
        actorRole:  'SUPER_ADMIN',
        action:     'USER_DELETED',
        entityType: 'users',
        entityId:   userId,
        metadata:   { originalEmail: user.email },
      },
    }),
  ])

  return { deleted: true }
}

export async function getAdminIssuesService() {
  const issues = await prisma.issue.findMany({
    where: { deletedAt: null },
    include: {
      tenant: { select: { fullName: true } },
      owner: { select: { user: { select: { email: true } }, businessName: true, fullName: true } },
      building: { select: { name: true } },
      room: { select: { roomNumber: true } },
      comments: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  })

  // Format the output
  const items = issues.map((i) => ({
    id: i.id,
    title: i.title,
    description: i.description,
    category: i.category,
    priority: i.priority,
    status: i.status,
    photoUrls: i.photoUrls,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
    tenant: i.tenant,
    owner: i.owner,
    building: i.building,
    room: i.room,
    latestComment: i.comments[0] || null,
  }))

  const summary = {
    open:       items.filter((i) => i.status === 'OPEN').length,
    inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
    verifying:  items.filter((i) => i.status === 'PENDING_TENANT_VERIFICATION').length,
    resolved:   items.filter((i) => i.status === 'RESOLVED').length,
  }

  return { items, summary }
}

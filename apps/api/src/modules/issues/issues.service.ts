import { prisma } from '@config/prisma'
import { BadRequestError, NotFoundError, ForbiddenError } from '@utils/errors'
import { ISSUE } from '@config/constants'
import { IssueStatus, IssuePriority, IssueCategory } from '@prisma/client'
import { parsePagination } from '@utils/pagination.util'
import { buildPaginationMeta } from '@utils/response.util'
import { createNoticeService } from '../notices/notices.service'

// Valid status transitions — owner can make these moves
const OWNER_TRANSITIONS: Record<string, IssueStatus[]> = {
  OPEN:        ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['PENDING_TENANT_VERIFICATION', 'REJECTED'],
  REOPENED:    ['IN_PROGRESS'],
}

export async function createIssueService(
  tenantUserId: string,
  dto: {
    category: IssueCategory; priority: IssuePriority
    title: string; description: string; photoUrls?: string[]
  }
) {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId }, select: { id: true },
  })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  // Must have an active booking to raise an issue
  const booking = await prisma.booking.findFirst({
    where: { tenantId: tenant.id, status: 'CONFIRMED' },
    select: { buildingId: true, ownerId: true, roomId: true, bedId: true },
  })
  if (!booking) throw new BadRequestError(
    'You must have an active booking to raise an issue.', 'NO_ACTIVE_BOOKING'
  )

  const reopenDeadline = new Date(
    Date.now() + ISSUE.REOPEN_WINDOW_HOURS * 3600 * 1000
  )

  const issue = await prisma.issue.create({
    data: {
      tenantId:       tenant.id,
      buildingId:     booking.buildingId,
      ownerId:        booking.ownerId,
      roomId:         booking.roomId ?? undefined,
      bedId:          booking.bedId ?? undefined,
      category:       dto.category,
      priority:       dto.priority,
      title:          dto.title,
      description:    dto.description,
      photoUrls:      dto.photoUrls ?? [],
      reopenDeadline,
    },
    select: { id: true, title: true, status: true, priority: true, category: true, createdAt: true },
  })

  return issue
}

export async function getMyIssuesService(tenantUserId: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query)
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId }, select: { id: true },
  })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  const { status } = query as Record<string, string>
  const where = {
    tenantId:  tenant.id,
    deletedAt: null,
    ...(status && { status: status as IssueStatus }),
  }

  const [issues, total] = await Promise.all([
    prisma.issue.findMany({
      where, skip, take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        comments: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take:    1,
          select:  { authorRole: true, body: true, createdAt: true },
        },
      },
    }),
    prisma.issue.count({ where }),
  ])

  const now = new Date()
  return {
    items: issues.map((i) => ({
      ...i,
      canReopen:     i.status === 'RESOLVED' && i.reopenDeadline
        ? now < i.reopenDeadline : false,
      latestComment: i.comments[0] ?? null,
    })),
    pagination: buildPaginationMeta(page, limit, total),
  }
}

export async function getMyIssueByIdService(issueId: string, tenantUserId: string) {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId }, select: { id: true },
  })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, tenantId: tenant.id, deletedAt: null },
    include: {
      building: { select: { name: true } },
      room:     { select: { roomNumber: true } },
      comments: {
        where:   { deletedAt: null },
        orderBy: { createdAt: 'asc' },
        include: { author: { select: { role: true } } },
      },
    },
  })
  if (!issue) throw new NotFoundError('Issue not found')

  const now = new Date()
  return {
    ...issue,
    canReopen: issue.status === 'RESOLVED' && issue.reopenDeadline
      ? now < issue.reopenDeadline : false,
  }
}

export async function addTenantCommentService(
  issueId: string, tenantUserId: string,
  dto: { body: string; photoUrls?: string[] }
) {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId },
    include: { user: { select: { id: true } } },
  })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, tenantId: tenant.id, deletedAt: null },
  })
  if (!issue) throw new NotFoundError('Issue not found')

  const now = new Date()
  const isResolved = issue.status === 'RESOLVED'
  const canComment = !isResolved ||
    (issue.reopenDeadline != null && now < issue.reopenDeadline)

  if (!canComment) {
    throw new BadRequestError('This issue is closed and no longer accepting comments')
  }

  return prisma.issueComment.create({
    data: {
      issueId,
      authorId:   tenant.user.id,
      authorRole: 'TENANT',
      body:       dto.body,
      photoUrls:  dto.photoUrls ?? [],
    },
    select: { id: true, body: true, createdAt: true },
  })
}

export async function reopenIssueService(
  issueId: string, tenantUserId: string, reason: string
) {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId }, select: { id: true },
  })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, tenantId: tenant.id, deletedAt: null },
  })
  if (!issue) throw new NotFoundError('Issue not found')
  if (issue.status !== 'RESOLVED') {
    throw new BadRequestError('Only resolved issues can be reopened', 'NOT_RESOLVED')
  }
  const now = new Date()
  if (!issue.reopenDeadline || now > issue.reopenDeadline) {
    throw new BadRequestError(
      `Reopen window has closed. Issues can be reopened within ${ISSUE.REOPEN_WINDOW_HOURS} hours of resolution.`,
      'REOPEN_DEADLINE_PASSED'
    )
  }

  await prisma.issue.update({
    where: { id: issueId },
    data:  { status: 'REOPENED', reopenedAt: now },
  })

  return { status: 'REOPENED' }
}

export async function getOwnerIssuesService(ownerId: string, query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query)
  const { buildingId, status, priority, category, search } = query as Record<string, string>

  const where = {
    ownerId,
    deletedAt: null,
    ...(buildingId && { buildingId }),
    ...(status    && { status:   status as IssueStatus }),
    ...(priority  && { priority: priority as IssuePriority }),
    ...(category  && { category: category as IssueCategory }),
    ...(search    && { title: { contains: search, mode: 'insensitive' as const } }),
  }

  const [issues, total, summary] = await Promise.all([
    prisma.issue.findMany({
      where, skip, take: limit,
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        tenant:   { select: { fullName: true } },
        building: { select: { name: true } },
        room:     { select: { roomNumber: true } },
        comments: {
          where:   { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take:    1,
          select:  { authorRole: true, body: true, createdAt: true },
        },
      },
    }),
    prisma.issue.count({ where }),
    prisma.issue.groupBy({
      by: ['status'],
      where: { ownerId, deletedAt: null },
      _count: true,
    }),
  ])

  const counts = Object.fromEntries(summary.map((s) => [s.status, s._count]))

  return {
    items: issues.map((i) => ({ ...i, latestComment: i.comments[0] ?? null })),
    pagination: buildPaginationMeta(page, limit, total),
    summary: {
      open:       counts.OPEN ?? 0,
      inProgress: counts.IN_PROGRESS ?? 0,
      resolved:   counts.RESOLVED ?? 0,
      urgent:     await prisma.issue.count({ where: { ownerId, priority: 'URGENT', status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] } } }),
    },
  }
}

export async function updateIssueStatusService(
  issueId: string, ownerId: string,
  dto: { status: IssueStatus | 'RESOLVED'; note?: string; rejectionReason?: string }
) {
  // Overwrite 'RESOLVED' from owner side to 'PENDING_TENANT_VERIFICATION'
  const requestedStatus = dto.status === 'RESOLVED' ? 'PENDING_TENANT_VERIFICATION' : dto.status

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, ownerId, deletedAt: null },
  })
  if (!issue) throw new NotFoundError('Issue not found')

  const allowed = OWNER_TRANSITIONS[issue.status]
  if (!allowed || !allowed.includes(requestedStatus)) {
    throw new BadRequestError(
      `Cannot transition from ${issue.status} to ${requestedStatus}`,
      'INVALID_STATUS_TRANSITION'
    )
  }

  if (requestedStatus === 'REJECTED' && !dto.rejectionReason) {
    throw new BadRequestError('Rejection reason is required', 'REJECTION_REASON_REQUIRED')
  }

  const now   = new Date()
  let slaDeadline = issue.slaDeadline

  if (requestedStatus === 'IN_PROGRESS' && issue.status !== 'IN_PROGRESS') {
    // 14 days SLA starts when the owner begins work
    slaDeadline = new Date(now.getTime() + 14 * 24 * 3600 * 1000)
  }

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      status:          requestedStatus as IssueStatus,
      slaDeadline,
      ...(requestedStatus === 'REJECTED'  && { rejectedAt: now, rejectionReason: dto.rejectionReason }),
    },
  })

  // Send a notice to the tenant to verify the resolution
  if (requestedStatus === 'PENDING_TENANT_VERIFICATION') {
    await createNoticeService(ownerId, {
      title: 'Issue Resolved - Please Verify',
      body: `The owner has marked your issue "${issue.title}" as resolved. Please verify if the problem is fixed.`,
      category: 'MAINTENANCE',
      targetType: 'TENANT',
      targetTenantId: issue.tenantId,
      sendEmail: false
    })
  }

  return { status: requestedStatus }
}

export async function verifyIssueResolutionService(
  issueId: string, tenantUserId: string,
  dto: { accepted: boolean; reason?: string }
) {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId },
    include: { user: { select: { id: true } } }
  })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  const issue = await prisma.issue.findFirst({
    where: { id: issueId, tenantId: tenant.id, deletedAt: null },
  })
  if (!issue) throw new NotFoundError('Issue not found')
  if (issue.status !== 'PENDING_TENANT_VERIFICATION') {
    throw new BadRequestError('Issue is not pending verification', 'NOT_PENDING_VERIFICATION')
  }

  const now = new Date()
  
  if (dto.accepted) {
    const hours = ISSUE.REOPEN_WINDOW_HOURS
    const reopenDeadline = new Date(now.getTime() + hours * 3600 * 1000)

    await prisma.issue.update({
      where: { id: issueId },
      data: { status: 'RESOLVED', resolvedAt: now, reopenDeadline }
    })
    return { status: 'RESOLVED', reopenDeadline }
  } else {
    // Rejected by tenant
    await prisma.issue.update({
      where: { id: issueId },
      data: { status: 'IN_PROGRESS' }
    })

    // Add comment indicating rejection
    await prisma.issueComment.create({
      data: {
        issueId,
        authorId: tenant.user.id,
        authorRole: 'TENANT',
        body: `Tenant rejected the resolution${dto.reason ? ': ' + dto.reason : '.'}`,
      }
    })

    // Send a notice + email to the owner
    await createNoticeService(issue.ownerId, {
      title: 'Issue Resolution Rejected',
      body: `The tenant ${tenant.fullName} has rejected the resolution for issue "${issue.title}". Reason: ${dto.reason || 'No reason provided.'}`,
      category: 'MAINTENANCE',
      targetType: 'ALL_BUILDINGS', // Since it's directed at the owner
      sendEmail: true
    })

    return { status: 'IN_PROGRESS' }
  }
}

export async function addOwnerCommentService(
  issueId: string, ownerId: string,
  dto: { body: string; photoUrls?: string[] }
) {
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, ownerId, deletedAt: null },
  })
  if (!issue) throw new NotFoundError('Issue not found')

  const ownerUser = await prisma.ownerProfile.findUnique({
    where: { id: ownerId }, include: { user: { select: { id: true } } },
  })
  if (!ownerUser) throw new NotFoundError('Owner not found')

  return prisma.issueComment.create({
    data: {
      issueId,
      authorId:   ownerUser.user.id,
      authorRole: 'OWNER',
      body:       dto.body,
      photoUrls:  dto.photoUrls ?? [],
    },
    select: { id: true, body: true, createdAt: true },
  })
}
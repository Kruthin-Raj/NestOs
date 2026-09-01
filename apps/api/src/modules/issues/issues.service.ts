import { prisma } from '@config/prisma'
import { BadRequestError, NotFoundError, ForbiddenError } from '@utils/errors'
import { ISSUE } from '@config/constants'
import { IssueStatus, IssuePriority, IssueCategory } from '@prisma/client'
import { parsePagination } from '@utils/pagination.util'
import { buildPaginationMeta } from '@utils/response.util'

// Valid status transitions — owner can make these moves
const OWNER_TRANSITIONS: Record<string, IssueStatus[]> = {
  OPEN:        ['IN_PROGRESS', 'REJECTED'],
  IN_PROGRESS: ['RESOLVED', 'REJECTED'],
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
  dto: { status: IssueStatus; note?: string; rejectionReason?: string }
) {
  const issue = await prisma.issue.findFirst({
    where: { id: issueId, ownerId, deletedAt: null },
  })
  if (!issue) throw new NotFoundError('Issue not found')

  const allowed = OWNER_TRANSITIONS[issue.status]
  if (!allowed || !allowed.includes(dto.status)) {
    throw new BadRequestError(
      `Cannot transition from ${issue.status} to ${dto.status}`,
      'INVALID_STATUS_TRANSITION'
    )
  }

  if (dto.status === 'REJECTED' && !dto.rejectionReason) {
    throw new BadRequestError('Rejection reason is required', 'REJECTION_REASON_REQUIRED')
  }

  const now   = new Date()
  const hours = ISSUE.REOPEN_WINDOW_HOURS
  const reopenDeadline = dto.status === 'RESOLVED'
    ? new Date(now.getTime() + hours * 3600 * 1000)
    : undefined

  await prisma.issue.update({
    where: { id: issueId },
    data: {
      status:          dto.status,
      ...(dto.status === 'RESOLVED'  && { resolvedAt: now, reopenDeadline }),
      ...(dto.status === 'REJECTED'  && { rejectedAt: now, rejectionReason: dto.rejectionReason }),
    },
  })

  return { status: dto.status, ...(reopenDeadline && { reopenDeadline }) }
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
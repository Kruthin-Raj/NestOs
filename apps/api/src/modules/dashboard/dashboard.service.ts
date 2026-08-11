import { prisma } from '@config/prisma'
import { NotFoundError } from '@utils/errors'

export async function getOwnerDashboardService(
  ownerId: string, buildingId?: string
) {
  const now = new Date()
  const thisMonth = now.getMonth() + 1
  const thisYear  = now.getFullYear()
  const lastMonth = thisMonth === 1 ? 12 : thisMonth - 1
  const lastYear  = thisMonth === 1 ? thisYear - 1 : thisYear

  const buildingFilter = buildingId
    ? { buildingId }
    : {}

  const ownerBuildingIds = (await prisma.building.findMany({
    where: { ownerId, deletedAt: null },
    select: { id: true },
  })).map((b) => b.id)

  const filteredIds = buildingId
    ? ownerBuildingIds.filter((id) => id === buildingId)
    : ownerBuildingIds

  const [
    occupancyStats, thisMonthPayments, lastMonthPayments,
    pendingPayments, recentPayments, issueStats,
    recentIssues, activeNotices, recentActivity, buildingStats,
  ] = await Promise.all([
    // Occupancy
    prisma.building.aggregate({
      where: { id: { in: filteredIds }, deletedAt: null },
      _sum: { totalBeds: true, occupiedBeds: true },
    }),

    // This month revenue
    prisma.payment.aggregate({
      where: { ownerId, status: 'SUCCESS', type: 'RENT',
               billingMonth: thisMonth, billingYear: thisYear,
               buildingId: buildingId ? buildingId : undefined },
      _sum: { amountRupees: true },
    }),

    // Last month revenue
    prisma.payment.aggregate({
      where: { ownerId, status: 'SUCCESS', type: 'RENT',
               billingMonth: lastMonth, billingYear: lastYear,
               buildingId: buildingId ? buildingId : undefined },
      _sum: { amountRupees: true },
    }),

    // Pending this month
    prisma.booking.findMany({
      where: { ownerId, status: 'CONFIRMED',
               buildingId: buildingId ? buildingId : undefined },
      include: {
        payments: {
          where: { type: 'RENT', billingMonth: thisMonth, billingYear: thisYear, status: 'SUCCESS' },
          select: { id: true },
        },
      },
    }),

    // Recent payments
    prisma.payment.findMany({
      where:   { ownerId, status: 'SUCCESS' },
      orderBy: { createdAt: 'desc' },
      take:    5,
      include: {
        tenant:   { select: { fullName: true } },
        building: { select: { name: true } },
      },
    }),

    // Issue counts
    prisma.issue.groupBy({
      by:    ['status'],
      where: { ownerId, deletedAt: null },
      _count: true,
    }),

    // Recent issues
    prisma.issue.findMany({
      where:   { ownerId, status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      take:    5,
      include: {
        tenant:   { select: { fullName: true } },
        building: { select: { name: true } },
      },
    }),

    // Active notices
    prisma.notice.count({
      where: { ownerId, deletedAt: null, publishAt: { lte: new Date() },
               OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] },
    }),

    // Recent audit activity
    prisma.auditLog.findMany({
      where:   { actorId: (await prisma.ownerProfile.findUnique({ where: { id: ownerId }, select: { userId: true } }))?.userId },
      orderBy: { createdAt: 'desc' },
      take:    5,
    }),

    // Per-building stats
    prisma.building.findMany({
      where: { id: { in: filteredIds }, deletedAt: null },
      select: { id: true, name: true, totalBeds: true, occupiedBeds: true },
    }),
  ])

  const totalBeds    = Number(occupancyStats._sum.totalBeds ?? 0)
  const occupiedBeds = Number(occupancyStats._sum.occupiedBeds ?? 0)
  const vacantBeds   = totalBeds - occupiedBeds

  const thisMonthTotal     = Number(thisMonthPayments._sum.amountRupees ?? 0)
  const lastMonthTotal     = Number(lastMonthPayments._sum.amountRupees ?? 0)
  const pendingBookings    = pendingPayments.filter((b) => b.payments.length === 0)
  const pendingAmount      = pendingBookings.reduce((sum, b) => sum + Number(b.monthlyRent), 0)
  const collectionRate     = thisMonthTotal + pendingAmount > 0
    ? ((thisMonthTotal / (thisMonthTotal + pendingAmount)) * 100).toFixed(1)
    : '0'

  const issueCounts = Object.fromEntries(issueStats.map((s) => [s.status, s._count]))

  return {
    occupancy: {
      totalBeds, occupiedBeds, vacantBeds,
      occupancyPercent: totalBeds > 0 ? +((occupiedBeds / totalBeds) * 100).toFixed(1) : 0,
    },
    revenue: {
      thisMonth:          thisMonthTotal,
      lastMonth:          lastMonthTotal,
      thisMonthCollected: thisMonthTotal,
      thisMonthPending:   pendingAmount,
      collectionRate:     parseFloat(collectionRate),
      overdueCount:       pendingBookings.length,
    },
    recentPayments: recentPayments.map((p) => ({
      id:           p.id,
      tenantName:   p.tenant.fullName,
      amountRupees: p.amountRupees,
      type:         p.type,
      status:       p.status,
      paidAt:       p.createdAt,
      buildingName: p.building.name,
    })),
    issues: {
      open:       issueCounts.OPEN       ?? 0,
      inProgress: issueCounts.IN_PROGRESS ?? 0,
      urgent: recentIssues.filter((i) => i.priority === 'URGENT').length,
      recentIssues: recentIssues.map((i) => ({
        id: i.id, title: i.title, priority: i.priority,
        status: i.status, tenantName: i.tenant.fullName,
        buildingName: i.building.name, createdAt: i.createdAt,
      })),
    },
    notices:      { totalActive: activeNotices },
    recentActivity: recentActivity.map((a) => ({
      type:        a.action,
      description: a.metadata,
      at:          a.createdAt,
    })),
    buildings: buildingStats.map((b) => ({
      id:               b.id,
      name:             b.name,
      occupancyPercent: b.totalBeds > 0
        ? +((b.occupiedBeds / b.totalBeds) * 100).toFixed(1)
        : 0,
    })),
  }
}

export async function getTenantDashboardService(tenantUserId: string) {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId: tenantUserId },
    include: { preferences: true },
  })
  if (!tenant) throw new NotFoundError('Tenant profile not found')

  if (tenant.status === 'ONBOARDING' || tenant.status === 'SEARCHING') {
    const featured = await prisma.building.findMany({
      where: { status: 'ACTIVE', deletedAt: null,
               ...(tenant.city && { city: { contains: tenant.city, mode: 'insensitive' } }) },
      take: 6,
      include: {
        amenities: { select: { name: true } },
        photos:    { take: 1, orderBy: { sortOrder: 'asc' }, select: { fileUrl: true } },
        beds:      { where: { status: 'VACANT', deletedAt: null }, select: { monthlyRent: true } },
      },
    })

    return {
      tenantStatus:   tenant.status,
      profileCompletion: tenant.profileCompletion,
      isIdVerified:   tenant.isIdVerified,
      profilePrompts: buildProfilePrompts(tenant),
      featuredProperties: featured.map((b) => ({
        id:           b.id,
        name:         b.name,
        city:         b.city,
        vacantBeds:   b.beds.length,
        minRent:      b.beds.length ? Math.min(...b.beds.map((bed) => Number(bed.monthlyRent))) : null,
        amenities:    b.amenities.map((a) => a.name).slice(0, 4),
        coverPhoto:   b.photos[0]?.fileUrl ?? null,
      })),
    }
  }

  // Active resident dashboard
  const activeBooking = await prisma.booking.findFirst({
    where:   { tenantId: tenant.id, status: 'CONFIRMED' },
    include: {
      building: { select: { name: true, addressLine1: true, city: true, contactPhone: true } },
      bed:      { select: { bedLabel: true } },
    },
  })

  const now         = new Date()
  const thisMonth   = now.getMonth() + 1
  const thisYear    = now.getFullYear()

  const thisMonthPayment = activeBooking
    ? await prisma.payment.findFirst({
        where: { tenantId: tenant.id, type: 'RENT',
                 billingMonth: thisMonth, billingYear: thisYear },
        select: { status: true, createdAt: true },
      })
    : null

  const openIssues = await prisma.issue.count({
    where: { tenantId: tenant.id, status: { in: ['OPEN', 'IN_PROGRESS', 'REOPENED'] } },
  })

  const recentIssues = await prisma.issue.findMany({
    where:   { tenantId: tenant.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take:    3,
    select:  { id: true, title: true, status: true },
  })

  // Build next rent due date
  let nextRentDue: Date | null = null

if (activeBooking) {
  const building = await prisma.building.findUnique({
    where: { id: activeBooking.buildingId },
    select: { rentDueDay: true },
  })

  const dueDay = building?.rentDueDay ?? 1
  nextRentDue = new Date(now.getFullYear(), now.getMonth(), dueDay)

  if (nextRentDue < now) {
    nextRentDue.setMonth(nextRentDue.getMonth() + 1)
  }
} else nextRentDue
    : null

  const unreadNotices = await prisma.notice.count({
    where: {
      deletedAt: null,
      publishAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      reads:     { none: { tenantId: tenant.id } },
    },
  })

  const recentNotices = await prisma.notice.findMany({
    where: { deletedAt: null, publishAt: { lte: now } },
    orderBy: { publishAt: 'desc' },
    take: 3,
    include: { reads: { where: { tenantId: tenant.id }, take: 1 } },
  })

  return {
    tenantStatus: tenant.status,
    activeBooking,
    rent: {
      nextDueDate:         await nextRentDue,
      nextDueAmount:       activeBooking ? Number(activeBooking.monthlyRent) : null,
      currentMonthStatus:  thisMonthPayment?.status ?? 'PENDING',
      paidAt:              thisMonthPayment?.createdAt ?? null,
    },
    issues: {
      open:          openIssues,
      recent:        recentIssues,
    },
    notices: {
      unreadCount: unreadNotices,
      recent: recentNotices.map((n) => ({
        id: n.id, title: n.title, isRead: n.reads.length > 0,
      })),
    },
    quickActions: buildQuickActions(tenant.status, activeBooking),
  }
}

function buildProfilePrompts(tenant: { fullName: string; phone: string | null; isIdVerified: boolean; emergencyPhone: string | null; preferences?: { smoking: string | null } | null }): string[] {
  const prompts: string[] = []
  if (!tenant.phone)         prompts.push('Add your phone number')
  if (!tenant.isIdVerified)  prompts.push('Verify your Aadhaar to unlock booking')
  if (!tenant.emergencyPhone) prompts.push('Add your emergency contact')
  if (!tenant.preferences?.smoking) prompts.push('Complete your lifestyle preferences')
  return prompts
}

function buildQuickActions(status: string, booking: unknown): Array<{ label: string; action: string; amount?: number }> {
  if (status !== 'ACTIVE' || !booking) return []
  const b = booking as { monthlyRent: number }
  return [
    { label: 'Pay rent', action: 'PAY_RENT', amount: Number(b.monthlyRent) },
    { label: 'Raise an issue', action: 'RAISE_ISSUE' },
  ]
}
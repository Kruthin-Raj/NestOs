import { Request, Response } from 'express'
import { prisma } from '@config/prisma'
import { AppError, BadRequestError, NotFoundError } from '@utils/errors'
import { sendSuccess, sendCreated } from '@utils/response.util'

export async function createReport(req: Request, res: Response) {
  const reporterId = req.user!.userId
  const { reportedUserId, reason } = req.body

  // Ensure reported user exists
  let finalReportedUserId = reportedUserId
  let targetUser = await prisma.user.findUnique({
    where: { id: reportedUserId }
  })

  // If not found as User, check if it's an OwnerProfile or TenantProfile ID
  if (!targetUser) {
    const ownerProfile = await prisma.ownerProfile.findUnique({ where: { id: reportedUserId } })
    if (ownerProfile) {
      targetUser = await prisma.user.findUnique({ where: { id: ownerProfile.userId } })
      finalReportedUserId = targetUser?.id
    } else {
      const tenantProfile = await prisma.tenantProfile.findUnique({ where: { id: reportedUserId } })
      if (tenantProfile) {
        targetUser = await prisma.user.findUnique({ where: { id: tenantProfile.userId } })
        finalReportedUserId = targetUser?.id
      }
    }
  }

  if (!targetUser || !finalReportedUserId) {
    throw new NotFoundError('Reported user not found')
  }

  if (reporterId === finalReportedUserId) {
    throw new BadRequestError('You cannot report yourself')
  }

  const report = await prisma.userReport.create({
    data: {
      reporterId,
      reportedUserId: finalReportedUserId,
      reason,
      status: 'PENDING'
    }
  })

  sendCreated(res, 'Report submitted successfully', report)
}

export async function getAdminReports(req: Request, res: Response) {
  const reports = await prisma.userReport.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      reporter: { select: { id: true, email: true, role: true } },
      reportedUser: { select: { id: true, email: true, role: true, rejectionCount: true, isEmailVerified: true } }
    }
  })
  sendSuccess(res, 'Reports fetched successfully', reports)
}

export async function updateAdminReport(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params
  const { status, adminNotes } = req.body

  const report = await prisma.userReport.findUnique({ where: { id } })
  if (!report) {
    throw new NotFoundError('Report not found')
  }

  const updated = await prisma.userReport.update({
    where: { id },
    data: {
      ...(status && { status }),
      ...(adminNotes !== undefined && { adminNotes })
    }
  })

  // If resolving and we want to auto-flag the owner, we can increment rejectionCount.
  // For now, admins can manually suspend or flag them through the Users UI,
  // or we can increment rejectionCount here if they decide it's a valid report.
  // We'll leave that to manual action or future enhancement.

  sendSuccess(res, 'Report updated successfully', updated)
}

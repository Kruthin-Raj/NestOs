import { Request, Response } from 'express'
import { prisma } from '@config/prisma'
import { AppError, BadRequestError, NotFoundError } from '@utils/errors'
import { sendSuccess, sendCreated } from '@utils/response.util'
import { createNoticeService } from '../notices/notices.service'

export async function createReport(req: Request, res: Response) {
  const reporterId = req.user!.userId
  const { reportedUserId, reason, attachments } = req.body

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
      attachments: attachments || [],
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
      reportedUser: { select: { id: true, email: true, role: true, rejectionCount: true, isEmailVerified: true } },
      escalation: true
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

export async function escalateReportToOwner(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params
  const { message } = req.body

  if (!message) {
    throw new BadRequestError('Escalation message is required')
  }

  const report = await prisma.userReport.findUnique({
    where: { id },
    include: { reportedUser: { include: { ownerProfile: true } } }
  })

  if (!report) {
    throw new NotFoundError('Report not found')
  }

  const ownerProfile = report.reportedUser.ownerProfile
  if (!ownerProfile) {
    throw new BadRequestError('Reported user is not an owner')
  }

  // Create escalated report
  const escalation = await prisma.escalatedReport.create({
    data: {
      reportId: id,
      ownerId: ownerProfile.id,
      message
    }
  })

  // Update the original report to indicate it has been escalated/reviewed
  await prisma.userReport.update({
    where: { id },
    data: {
      status: 'REVIEWED',
      adminNotes: 'Escalated to owner'
    }
  })

  // Create a standard Notice for the owner so it appears in their Notices tab
  await prisma.notice.create({
    data: {
      title: 'Action Required: Escalated Report',
      body: `An admin has escalated a report against you: ${message}. Escalation ID: ${escalation.id}`,
      category: 'MAINTENANCE',
      targetType: 'ALL_BUILDINGS', // Directed at owner
      ownerId: ownerProfile.id,
      sendEmail: true
    }
  })

  sendCreated(res, 'Report escalated to owner successfully', escalation)
}

export async function resolveEscalatedReport(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params
  const userId = req.user!.userId
  const { ownerNote } = req.body || {}

  const ownerProfile = await prisma.ownerProfile.findUnique({ where: { userId } })
  if (!ownerProfile) {
    throw new BadRequestError('You are not registered as an owner')
  }

  const alert = await prisma.escalatedReport.findUnique({ where: { id } })
  if (!alert) {
    throw new NotFoundError('Escalated report not found')
  }

  if (alert.ownerId !== ownerProfile.id) {
    throw new BadRequestError('Not authorized to resolve this alert')
  }

  const resolved = await prisma.escalatedReport.update({
    where: { id },
    data: {
      isResolved: true,
      resolvedAt: new Date(),
      ...(ownerNote && { ownerNote })
    }
  })

  // We intentionally leave the parent UserReport as REVIEWED (or whatever it is).
  // The superadmin must manually change it to RESOLVED in the Admin Panel to fully close the issue.

  sendSuccess(res, 'Alert resolved successfully', resolved)
}

export async function sendReportVerification(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params

  const escalation = await prisma.escalatedReport.findUnique({
    where: { id },
    include: {
      report: true,
      owner: { include: { user: true } }
    }
  })

  if (!escalation) {
    throw new NotFoundError('Escalated report not found')
  }

  // Set verification timestamp
  const updated = await prisma.escalatedReport.update({
    where: { id },
    data: {
      adminVerificationSentAt: new Date(),
    }
  })

  // Determine the target tenant (reporter)
  const reporterId = escalation.report.reporterId
  const tenantProfile = await prisma.tenantProfile.findUnique({ where: { userId: reporterId } })
  if (tenantProfile) {
    // Insert notice directly since admin is sending it, bypassing owner ownership checks
    await prisma.notice.create({
      data: {
        title: 'Report Resolution Verification',
        body: `The owner has marked your report as resolved. Please verify if the issue is fixed. Escalation ID: ${escalation.id}`,
        category: 'MAINTENANCE',
        targetType: 'TENANT',
        targetTenantId: tenantProfile.id,
        ownerId: escalation.ownerId, // associate the notice with the original owner
        sendEmail: true
      }
    })
  }

  sendSuccess(res, 'Verification sent to tenant', updated)
}

export async function verifyEscalatedReport(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params
  const { accepted, reason } = req.body
  const userId = req.user!.userId

  const escalation = await prisma.escalatedReport.findUnique({
    where: { id },
    include: {
      report: true,
      owner: { include: { user: true } }
    }
  })

  if (!escalation) {
    throw new NotFoundError('Escalated report not found')
  }

  if (escalation.report.reporterId !== userId) {
    throw new BadRequestError('Not authorized to verify this report')
  }

  if (accepted) {
    // Verified by tenant
    const updated = await prisma.escalatedReport.update({
      where: { id },
      data: { tenantVerified: true }
    })
    
    // Also update parent UserReport to RESOLVED
    await prisma.userReport.update({
      where: { id: escalation.reportId },
      data: { status: 'RESOLVED' }
    })

    // Find and update the notice to hide buttons and show details
    const tenantProfile = await prisma.tenantProfile.findUnique({ where: { userId } })
    if (tenantProfile) {
      const notices = await prisma.notice.findMany({
        where: {
          targetTenantId: tenantProfile.id,
          title: 'Report Resolution Verification',
          body: { contains: `Escalation ID: ${id}` }
        }
      })
      for (const notice of notices) {
        await prisma.notice.update({
          where: { id: notice.id },
          data: {
            body: `You have verified that this report is resolved.\nRaised At: ${new Date(escalation.report.createdAt).toLocaleString()}\nResolved At: ${new Date().toLocaleString()}`
          }
        })
      }
    }

    return sendSuccess(res, 'Verification accepted', updated)
  } else {
    // Rejected by tenant
    const updated = await prisma.escalatedReport.update({
      where: { id },
      data: { 
        isResolved: false, 
        adminVerificationSentAt: null,
        tenantVerified: false 
      }
    })

    // Notify the owner
    const tenantUser = await prisma.user.findUnique({ where: { id: userId } })
    await prisma.notice.create({
      data: {
        title: 'Report Resolution Rejected',
        body: `The reporter (${tenantUser?.email}) has rejected the resolution for the report. Reason: ${reason || 'None provided.'}`,
        category: 'MAINTENANCE',
        targetType: 'ALL_BUILDINGS', // Meaning it goes to the specific owner... wait, notice logic says ownerId=escalation.ownerId
        ownerId: escalation.ownerId,
      }
    })
    
    // update parent UserReport back to REVIEWED
    await prisma.userReport.update({
      where: { id: escalation.reportId },
      data: { status: 'REVIEWED' }
    })
    // Find and update the notice to hide buttons
    const tenantProfile = await prisma.tenantProfile.findUnique({ where: { userId } })
    if (tenantProfile) {
      const notices = await prisma.notice.findMany({
        where: {
          targetTenantId: tenantProfile.id,
          title: 'Report Resolution Verification',
          body: { contains: `Escalation ID: ${id}` }
        }
      })
      for (const notice of notices) {
        await prisma.notice.update({
          where: { id: notice.id },
          data: {
            body: `You have rejected the resolution. The owner has been notified to revisit this issue.\nRaised At: ${new Date(escalation.report.createdAt).toLocaleString()}`
          }
        })
      }
    }


    return sendSuccess(res, 'Verification rejected, owner notified', updated)
  }
}

export async function dismissEscalatedAlert(req: Request<{ id: string }>, res: Response) {
  const { id } = req.params

  const escalation = await prisma.escalatedReport.findUnique({
    where: { id }
  })

  if (!escalation) {
    throw new NotFoundError('Escalated report not found')
  }

  const ownerProfile = await prisma.ownerProfile.findUnique({
    where: { userId: req.user!.userId }
  })

  if (escalation.ownerId !== ownerProfile?.id) {
    throw new BadRequestError('Not authorized to dismiss this alert')
  }

  const updated = await prisma.escalatedReport.update({
    where: { id },
    data: { ownerDismissedAt: new Date() }
  })

  return sendSuccess(res, 'Alert dismissed', updated)
}


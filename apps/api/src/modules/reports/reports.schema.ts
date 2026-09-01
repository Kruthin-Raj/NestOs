import { z } from 'zod'
import { ReportStatus } from '@prisma/client'

export const createReportSchema = z.object({
  reportedUserId: z.string().uuid('Invalid user ID'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(1000, 'Reason is too long'),
})

export const updateReportSchema = z.object({
  status: z.nativeEnum(ReportStatus).optional(),
  adminNotes: z.string().max(1000).optional(),
})

export type CreateReportInput = z.infer<typeof createReportSchema>
export type UpdateReportInput = z.infer<typeof updateReportSchema>

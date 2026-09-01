import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { isAdmin } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { createReportSchema, updateReportSchema } from './reports.schema'
import { createReport, getAdminReports, updateAdminReport } from './reports.controller'

export const reportsRouter: ReturnType<typeof Router> = Router()

// Any authenticated user can submit a report
reportsRouter.post('/',
  authenticate,
  validate(createReportSchema),
  asyncHandler(createReport)
)

// Admin routes
reportsRouter.get('/admin',
  authenticate, isAdmin,
  asyncHandler(getAdminReports)
)

reportsRouter.patch('/admin/:id',
  authenticate, isAdmin,
  validate(updateReportSchema),
  asyncHandler(updateAdminReport)
)

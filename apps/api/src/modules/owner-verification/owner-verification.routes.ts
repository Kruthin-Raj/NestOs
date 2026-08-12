import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { requireOwnerAny } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess } from '@utils/response.util'
import { submitVerificationSchema } from './owner-verification.validation'
import {
  getVerificationStatusService,
  submitVerificationService,
  getOwnerDocumentsService,
} from './owner-verification.service'

export const ownerVerificationRouter: ReturnType<typeof Router> = Router()
ownerVerificationRouter.use(authenticate, requireOwnerAny)

ownerVerificationRouter.get('/status',
  asyncHandler(async (req, res) => {
    const result = await getVerificationStatusService(req.resourceOwnerId!)
    sendSuccess(res, 'Verification status fetched', result)
  })
)

ownerVerificationRouter.get('/documents',
  asyncHandler(async (req, res) => {
    const result = await getOwnerDocumentsService(req.resourceOwnerId!)
    sendSuccess(res, 'Documents fetched', result)
  })
)

ownerVerificationRouter.post('/submit',
  validate(submitVerificationSchema),
  asyncHandler(async (req, res) => {
    const result = await submitVerificationService(req.resourceOwnerId!, req.body)
    sendSuccess(
      res,
      'Verification submitted. You will receive an email when reviewed.',
      result
    )
  })
)

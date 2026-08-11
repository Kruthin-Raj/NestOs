import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { requireOwnerAny } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { submitVerificationSchema } from './owner-verification.validation'
import {
  getVerificationStatus,
  submitVerification,
  getOwnerDocuments,
} from './owner-verification.controller'

export const ownerVerificationRouter: ReturnType<typeof Router> = Router()
ownerVerificationRouter.use(authenticate, requireOwnerAny)

ownerVerificationRouter.get('/status',    getVerificationStatus)
ownerVerificationRouter.get('/documents', getOwnerDocuments)
ownerVerificationRouter.post('/submit',   validate(submitVerificationSchema), submitVerification)
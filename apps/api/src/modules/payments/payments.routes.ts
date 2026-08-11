import { Router  } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { strictRateLimit } from '@middleware/rate-limit.middleware'
import {
  createPaymentOrder, submitUpiReference, confirmPayment,
  getMyPayments, getReceipt, getOwnerPayments,
} from './payments.controller'

export const paymentsRouter: ReturnType<typeof Router> = Router()

// Tenant routes
paymentsRouter.post(
  '/create-order',
  authenticate, isTenant, strictRateLimit,
  validate(z.object({
    bookingId:    z.string().uuid(),
    type:         z.enum(['RENT', 'SECURITY_DEPOSIT']),
    billingMonth: z.number().int().min(1).max(12).optional(),
    billingYear:  z.number().int().min(2024).max(2100).optional(),
  })),
  createPaymentOrder
)

// Tenant submits UPI transaction reference (UTR) after paying
paymentsRouter.patch(
  '/:paymentId/upi-reference',
  authenticate, isTenant,
  validate(z.object({
    upiTransactionId: z.string().min(1).max(100),
  })),
  submitUpiReference
)

paymentsRouter.get('/my', authenticate, isTenant, getMyPayments)
paymentsRouter.get('/my/:paymentId/receipt', authenticate, isTenant, getReceipt)

// Owner routes
paymentsRouter.patch(
  '/:paymentId/confirm',
  authenticate, requireVerifiedOwner,
  confirmPayment
)
paymentsRouter.get('/owner', authenticate, requireVerifiedOwner, getOwnerPayments)
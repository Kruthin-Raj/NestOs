import { Router } from 'express'
import { z } from 'zod'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant, requireVerifiedOwner } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { strictRateLimit } from '@middleware/rate-limit.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated } from '@utils/response.util'
import {
  createPaymentOrderService,
  submitUpiReferenceService,
  confirmPaymentService,
  getMyPaymentsService,
  getReceiptService,
  getOwnerPaymentsService,
} from './payments.service'

type PaymentParams = { paymentId: string }

export const paymentsRouter: ReturnType<typeof Router> = Router()

// Tenant routes
paymentsRouter.post('/create-order',
  authenticate, isTenant, strictRateLimit,
  validate(z.object({
    bookingId:    z.string().uuid(),
    type:         z.enum(['RENT', 'SECURITY_DEPOSIT']),
    billingMonth: z.number().int().min(1).max(12).optional(),
    billingYear:  z.number().int().min(2024).max(2100).optional(),
  })),
  asyncHandler(async (req, res) => {
    const r = await createPaymentOrderService(req.user!.userId, req.body)
    sendCreated(res, 'Payment order created — use UPI to pay', r)
  })
)

// Tenant submits UPI transaction reference (UTR) after paying
paymentsRouter.patch('/:paymentId/upi-reference',
  authenticate, isTenant,
  validate(z.object({
    upiTransactionId: z.string().min(1).max(100),
  })),
  asyncHandler<PaymentParams>(async (req, res) => {
    const r = await submitUpiReferenceService(
      req.params.paymentId,
      req.user!.userId,
      req.body
    )
    sendSuccess(res, 'UPI transaction reference submitted', r)
  })
)

paymentsRouter.get('/my',
  authenticate, isTenant,
  asyncHandler(async (req, res) => {
    const r = await getMyPaymentsService(
      req.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Payments fetched', r)
  })
)

paymentsRouter.get('/my/:paymentId/receipt',
  authenticate, isTenant,
  asyncHandler<PaymentParams>(async (req, res) => {
    const r = await getReceiptService(req.params.paymentId, req.user!.userId)
    sendSuccess(res, 'Receipt fetched', r)
  })
)

// Owner routes
paymentsRouter.patch('/:paymentId/confirm',
  authenticate, requireVerifiedOwner,
  asyncHandler<PaymentParams>(async (req, res) => {
    const r = await confirmPaymentService(req.params.paymentId, req.user!.userId)
    sendSuccess(res, 'Payment confirmed', r)
  })
)

paymentsRouter.get('/owner',
  authenticate, requireVerifiedOwner,
  asyncHandler(async (req, res) => {
    const r = await getOwnerPaymentsService(
      req.resourceOwnerId!,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Payments fetched', r)
  })
)

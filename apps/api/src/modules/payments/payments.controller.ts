import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess, sendCreated } from '@utils/response.util'
import {
  createPaymentOrderService,
  submitUpiReferenceService,
  confirmPaymentService,
  getMyPaymentsService,
  getReceiptService,
  getOwnerPaymentsService,
} from './payments.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  resourceOwnerId?: string
  params: {
    paymentId?: string
  }
}

export async function createPaymentOrder(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await createPaymentOrderService(authReq.user!.userId, req.body)
    sendCreated(res, 'Payment order created — use UPI to pay', r)
  } catch (err) {
    next(err)
  }
}

export async function submitUpiReference(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await submitUpiReferenceService(
      authReq.params.paymentId!,
      authReq.user!.userId,
      req.body
    )
    sendSuccess(res, 'UPI transaction reference submitted', r)
  } catch (err) {
    next(err)
  }
}

export async function confirmPayment(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await confirmPaymentService(
      authReq.params.paymentId!,
      authReq.user!.userId
    )
    sendSuccess(res, 'Payment confirmed', r)
  } catch (err) {
    next(err)
  }
}

export async function getMyPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await getMyPaymentsService(
      authReq.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Payments fetched', r)
  } catch (err) {
    next(err)
  }
}

export async function getReceipt(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await getReceiptService(
      authReq.params.paymentId!,
      authReq.user!.userId
    )
    sendSuccess(res, 'Receipt fetched', r)
  } catch (err) {
    next(err)
  }
}

export async function getOwnerPayments(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await getOwnerPaymentsService(
      authReq.resourceOwnerId!,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Payments fetched', r)
  } catch (err) {
    next(err)
  }
}
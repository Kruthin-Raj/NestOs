import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '@utils/response.util'
import {
  getVerificationStatusService,
  submitVerificationService,
  getOwnerDocumentsService,
} from './owner-verification.service'

type OwnerRequest = Request & {
  resourceOwnerId?: string
}

export async function getVerificationStatus(
  req: OwnerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await getVerificationStatusService(req.resourceOwnerId!)
    sendSuccess(res, 'Verification status fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function submitVerification(
  req: OwnerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await submitVerificationService(req.resourceOwnerId!, req.body)
    sendSuccess(
      res,
      'Verification submitted. You will receive an email when reviewed.',
      result
    )
  } catch (err) {
    next(err)
  }
}

export async function getOwnerDocuments(
  req: OwnerRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await getOwnerDocumentsService(req.resourceOwnerId!)
    sendSuccess(res, 'Documents fetched', result)
  } catch (err) {
    next(err)
  }
}
import { Request, Response, NextFunction } from 'express'
import { UserRole } from '@prisma/client'
import { sendSuccess, sendCreated } from '@utils/response.util'
import {
  createBookingService,
  getMyBookingsService,
  getBookingByIdService,
  cancelBookingService,
} from './bookings.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: UserRole
    email: string
  }
  params: {
    bookingId?: string
  }
}

export async function createBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await createBookingService(authReq.user!.userId, req.body)
    sendCreated(res, 'Booking initiated. Complete payment to confirm.', r)
  } catch (err) {
    next(err)
  }
}

export async function getMyBookings(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await getMyBookingsService(
      authReq.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Bookings fetched', r)
  } catch (err) {
    next(err)
  }
}

export async function getBookingById(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await getBookingByIdService(
      authReq.params.bookingId!,
      authReq.user!.userId,
      authReq.user!.role
    )
    sendSuccess(res, 'Booking fetched', r)
  } catch (err) {
    next(err)
  }
}

export async function cancelBooking(req: Request, res: Response, next: NextFunction) {
  try {
    const authReq = req as AuthenticatedRequest
    const r = await cancelBookingService(
      authReq.params.bookingId!,
      authReq.user!.userId,
      authReq.user!.role,
      req.body
    )
    sendSuccess(res, 'Booking cancelled', r)
  } catch (err) {
    next(err)
  }
}
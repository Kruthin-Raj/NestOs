import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { strictRateLimit } from '@middleware/rate-limit.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated } from '@utils/response.util'
import { createBookingSchema, cancelBookingSchema } from './bookings.validation'
import {
  createBookingService,
  getMyBookingsService,
  getBookingByIdService,
  cancelBookingService,
} from './bookings.service'

type BookingParams = { bookingId: string }

export const bookingsRouter: ReturnType<typeof Router> = Router()

bookingsRouter.post('/',
  authenticate, isTenant, strictRateLimit,
  validate(createBookingSchema),
  asyncHandler(async (req, res) => {
    const r = await createBookingService(req.user!.userId, req.body)
    sendCreated(res, 'Booking initiated. Complete payment to confirm.', r)
  })
)

bookingsRouter.get('/my',
  authenticate, isTenant,
  asyncHandler(async (req, res) => {
    const r = await getMyBookingsService(
      req.user!.userId,
      req.query as Record<string, unknown>
    )
    sendSuccess(res, 'Bookings fetched', r)
  })
)

bookingsRouter.get('/:bookingId',
  authenticate,
  asyncHandler<BookingParams>(async (req, res) => {
    const r = await getBookingByIdService(
      req.params.bookingId,
      req.user!.userId,
      req.user!.role
    )
    sendSuccess(res, 'Booking fetched', r)
  })
)

bookingsRouter.post('/:bookingId/cancel',
  authenticate,
  validate(cancelBookingSchema),
  asyncHandler<BookingParams>(async (req, res) => {
    const r = await cancelBookingService(
      req.params.bookingId,
      req.user!.userId,
      req.user!.role,
      req.body
    )
    sendSuccess(res, 'Booking cancelled', r)
  })
)

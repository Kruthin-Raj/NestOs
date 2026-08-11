import { Router } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { isTenant } from '@middleware/rbac.middleware'
import { validate } from '@middleware/validate.middleware'
import { strictRateLimit } from '@middleware/rate-limit.middleware'
import { createBookingSchema, cancelBookingSchema } from './bookings.validation'
import { createBooking, getMyBookings, getBookingById, cancelBooking } from './bookings.controller'

export const bookingsRouter: ReturnType<typeof Router> = Router()
bookingsRouter.post('/',
  authenticate, isTenant, strictRateLimit,
  validate(createBookingSchema), createBooking
)
bookingsRouter.get('/my', authenticate, isTenant, getMyBookings)
bookingsRouter.get('/:bookingId', authenticate, getBookingById)
bookingsRouter.post('/:bookingId/cancel',
  authenticate, validate(cancelBookingSchema), cancelBooking
)
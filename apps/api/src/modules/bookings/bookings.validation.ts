import { z } from 'zod'
import { BOOKING } from '@config/constants'

export const createBookingSchema = z.object({
  bedId:      z.string().uuid('Invalid bed ID'),
  moveInDate: z.string()
    .refine((d) => {
      const date = new Date(d)
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const maxDate = new Date()
      maxDate.setDate(maxDate.getDate() + BOOKING.MAX_ADVANCE_DAYS)
      return date >= today && date <= maxDate
    }, `Move-in date must be between today and ${BOOKING.MAX_ADVANCE_DAYS} days from now`),
})

export const cancelBookingSchema = z.object({
  reason: z.string().min(5).max(500).trim(),
})

export type CreateBookingDto = z.infer<typeof createBookingSchema>
export type CancelBookingDto = z.infer<typeof cancelBookingSchema>
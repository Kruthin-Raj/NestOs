import { z } from 'zod'
import { optional, phoneNumber } from '@utils/zod.util'

const buildingBaseSchema = z.object({
  name: z.string().min(3).max(255).trim(),
  type: z.enum(['PG', 'HOSTEL', 'APARTMENT', 'SHARED_FLAT']),
  genderPreference: z.enum(['MALE', 'FEMALE', 'CO_ED']),
  addressLine1: z.string().min(5).max(255).trim(),
  addressLine2: optional(z.string().max(255)),
  landmark: optional(z.string().max(255)),
  city: z.string().min(2).max(100).trim(),
  state: z.string().min(2).max(100).trim(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  totalFloors: z.number().int().min(1).max(50),
  description: optional(z.string().max(2000)),
  rules: optional(z.string().max(2000)),
  depositMonths: z.number().int().min(0).max(6).optional(),
  depositFixed: z.number().positive().optional(),
  rentDueDay: z.number().int().min(1).max(28),
  // Left blank this used to send "", which is a string, so .optional() never
  // applied and the regex rejected the whole request — every building created
  // without a contact phone failed validation.
  contactPhone: optional(phoneNumber),
  contactEmail: optional(z.string().email()),
  googleMapsUrl: optional(z.string().url('Must be a valid URL')),
  amenities: z.array(z.string().max(50)).max(20).optional(),
})

export const createBuildingSchema = buildingBaseSchema.refine(
  (data) => !(data.depositMonths !== undefined && data.depositFixed !== undefined),
  {
    message: 'Provide either depositMonths or depositFixed, not both',
    path: ['depositFixed'],
  }
)

export const updateBuildingSchema = buildingBaseSchema
  .omit({ type: true })
  .partial()
  .refine(
    (data) => !(data.depositMonths !== undefined && data.depositFixed !== undefined),
    {
      message: 'Provide either depositMonths or depositFixed, not both',
      path: ['depositFixed'],
    }
  )

export const updateBuildingStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
})

export const getBuildingsQuerySchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  status: z.enum(['DRAFT', 'ACTIVE', 'INACTIVE', 'UNDER_REVIEW']).optional(),
  city: z.string().optional(),
  search: z.string().optional(),
})

export type CreateBuildingDto = z.infer<typeof createBuildingSchema>
export type UpdateBuildingDto = z.infer<typeof updateBuildingSchema>
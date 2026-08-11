import { z } from 'zod'

const buildingBaseSchema = z.object({
  name: z.string().min(3).max(255).trim(),
  type: z.enum(['PG', 'HOSTEL', 'APARTMENT', 'SHARED_FLAT']),
  genderPreference: z.enum(['MALE', 'FEMALE', 'CO_ED']),
  addressLine1: z.string().min(5).max(255).trim(),
  addressLine2: z.string().max(255).optional(),
  landmark: z.string().max(255).optional(),
  city: z.string().min(2).max(100).trim(),
  state: z.string().min(2).max(100).trim(),
  pincode: z.string().regex(/^\d{6}$/, 'Pincode must be 6 digits'),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  totalFloors: z.number().int().min(1).max(50),
  description: z.string().max(2000).optional(),
  rules: z.string().max(2000).optional(),
  depositMonths: z.number().int().min(0).max(6).optional(),
  depositFixed: z.number().positive().optional(),
  rentDueDay: z.number().int().min(1).max(28),
  contactPhone: z.string().regex(/^\+91[6-9]\d{9}$/).optional(),
  contactEmail: z.string().email().optional(),
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
import { z } from 'zod'

const indianPhone = z
  .string()
  .regex(/^\+91[6-9]\d{9}$/, 'Must be a valid Indian mobile number (+91XXXXXXXXXX)')

export const updateOwnerProfileSchema = z.object({
  fullName:     z.string().min(2).max(255).trim().optional(),
  businessName: z.string().max(255).trim().optional(),
  phone:        indianPhone.optional(),
  city:         z.string().max(100).trim().optional(),
  state:        z.string().max(100).trim().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

export const updateTenantProfileSchema = z.object({
  fullName:           z.string().min(2).max(255).trim().optional(),
  phone:              indianPhone.optional(),
  dateOfBirth:        z.string()
    .refine((d) => {
      const dob = new Date(d)
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)
      return age >= 18
    }, 'Must be at least 18 years old')
    .optional(),
  gender:             z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT']).optional(),
  profession:         z.enum(['STUDENT', 'WORKING_PROFESSIONAL', 'OTHER']).optional(),
  employerOrCollege:  z.string().max(255).trim().optional(),
  city:               z.string().max(100).trim().optional(),
  emergencyName:      z.string().max(255).trim().optional(),
  emergencyPhone:     indianPhone.optional(),
  emergencyRelation:  z.string().max(100).trim().optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided' }
)

export const updatePreferencesSchema = z.object({
  smoking:              z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY']).optional(),
  drinking:             z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY']).optional(),
  foodPreference:       z.enum(['VEG', 'NON_VEG', 'EGGETARIAN', 'JAIN', 'ANY']).optional(),
  sleepSchedule:        z.enum(['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE']).optional(),
  workSchedule:         z.enum(['WORK_FROM_HOME', 'OFFICE', 'STUDENT', 'MIXED']).optional(),
  cleanlinessLevel:     z.enum(['VERY_CLEAN', 'MODERATE', 'RELAXED']).optional(),
  noiseLevel:           z.enum(['SILENT', 'MODERATE', 'LOUD_OK']).optional(),
  guestsAllowed:        z.enum(['NEVER', 'OCCASIONALLY', 'OFTEN']).optional(),
  petsAllowed:          z.boolean().optional(),
  preferredGender:      z.enum(['MALE', 'FEMALE', 'ANY']).optional(),
  preferredSmoking:     z.enum(['NEVER', 'OCCASIONALLY', 'ANY']).optional(),
  preferredFoodPref:    z.enum(['VEG', 'NON_VEG', 'ANY']).optional(),
  preferredSleepSchedule: z.enum(['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE', 'ANY']).optional(),
  preferredCleanliness: z.enum(['VERY_CLEAN', 'MODERATE', 'ANY']).optional(),
  personalIcks:         z.string().max(1000).optional(),
  compatibilityBio:     z.string().max(500).optional(),
})

export type UpdateOwnerProfileDto  = z.infer<typeof updateOwnerProfileSchema>
export type UpdateTenantProfileDto = z.infer<typeof updateTenantProfileSchema>
export type UpdatePreferencesDto   = z.infer<typeof updatePreferencesSchema>
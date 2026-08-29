import { z } from 'zod'
import { optional, phoneNumber } from '@utils/zod.util'

export const updateOwnerProfileSchema = z.object({
  fullName:          optional(z.string().min(2).max(255).trim()),
  businessName:      optional(z.string().max(255).trim()),
  phone:             optional(phoneNumber),
  city:              optional(z.string().max(100).trim()),
  state:             optional(z.string().max(100).trim()),
  upiId:             optional(z.string().max(255).trim()),
  bankName:          optional(z.string().max(255).trim()),
  bankAccountName:   optional(z.string().max(255).trim()),
  bankAccountNumber: optional(z.string().max(100).trim()),
  bankIfscCode:      optional(z.string().max(100).trim()),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
)

export const updateTenantProfileSchema = z.object({
  fullName:           optional(z.string().min(2).max(255).trim()),
  phone:              optional(phoneNumber),
  dateOfBirth:        optional(
    z.string().refine((d) => {
      const dob = new Date(d)
      const age = (Date.now() - dob.getTime()) / (365.25 * 24 * 3600 * 1000)
      return age >= 18
    }, 'Must be at least 18 years old')
  ),
  gender:             optional(z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT'])),
  profession:         optional(z.enum(['STUDENT', 'WORKING_PROFESSIONAL', 'OTHER'])),
  employerOrCollege:  optional(z.string().max(255).trim()),
  city:               optional(z.string().max(100).trim()),
  emergencyName:      optional(z.string().max(255).trim()),
  emergencyPhone:     optional(phoneNumber),
  emergencyRelation:  optional(z.string().max(100).trim()),
}).refine(
  (data) => Object.values(data).some((v) => v !== undefined),
  { message: 'At least one field must be provided' }
)

export const updatePreferencesSchema = z.object({
  smoking:              optional(z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY'])),
  drinking:             optional(z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY'])),
  foodPreference:       optional(z.enum(['VEG', 'NON_VEG', 'EGGETARIAN', 'JAIN', 'ANY'])),
  sleepSchedule:        optional(z.enum(['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE'])),
  workSchedule:         optional(z.enum(['WORK_FROM_HOME', 'OFFICE', 'STUDENT', 'MIXED'])),
  cleanlinessLevel:     optional(z.enum(['VERY_CLEAN', 'MODERATE', 'RELAXED'])),
  noiseLevel:           optional(z.enum(['SILENT', 'MODERATE', 'LOUD_OK'])),
  guestsAllowed:        optional(z.enum(['NEVER', 'OCCASIONALLY', 'OFTEN'])),
  petsAllowed:          z.boolean().optional(),
  preferredGender:      optional(z.enum(['MALE', 'FEMALE', 'ANY'])),
  preferredSmoking:     optional(z.enum(['NEVER', 'OCCASIONALLY', 'ANY'])),
  preferredFoodPref:    optional(z.enum(['VEG', 'NON_VEG', 'ANY'])),
  preferredSleepSchedule: optional(z.enum(['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE', 'ANY'])),
  preferredCleanliness: optional(z.enum(['VERY_CLEAN', 'MODERATE', 'ANY'])),
  personalIcks:         optional(z.string().max(1000)),
  compatibilityBio:     optional(z.string().max(500)),
})

export type UpdateOwnerProfileDto  = z.infer<typeof updateOwnerProfileSchema>
export type UpdateTenantProfileDto = z.infer<typeof updateTenantProfileSchema>
export type UpdatePreferencesDto   = z.infer<typeof updatePreferencesSchema>

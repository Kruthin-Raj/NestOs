import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils/cn'

const profileSchema = z.object({
  fullName:          z.string().min(2, 'Enter your full name'),
  phone:             z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter valid Indian mobile'),
  dateOfBirth:       z.string().refine((d) => {
    const age = (Date.now() - new Date(d).getTime()) / (365.25 * 24 * 3600 * 1000)
    return age >= 18
  }, 'You must be at least 18 years old'),
  gender:            z.enum(['MALE', 'FEMALE', 'OTHER', 'PREFER_NOT']),
  profession:        z.enum(['STUDENT', 'WORKING_PROFESSIONAL', 'OTHER']),
  employerOrCollege: z.string().optional(),
  city:              z.string().min(2),
  emergencyName:     z.string().min(2),
  emergencyPhone:    z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter valid number'),
  emergencyRelation: z.string().min(2),
})

const prefsSchema = z.object({
  smoking:         z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY']),
  drinking:        z.enum(['NEVER', 'OCCASIONALLY', 'REGULARLY']),
  foodPreference:  z.enum(['VEG', 'NON_VEG', 'EGGETARIAN', 'JAIN', 'ANY']),
  sleepSchedule:   z.enum(['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE']),
  cleanlinessLevel:z.enum(['VERY_CLEAN', 'MODERATE', 'RELAXED']),
  compatibilityBio:z.string().max(500).optional(),
})

type ProfileValues = z.infer<typeof profileSchema>
type PrefsValues   = z.infer<typeof prefsSchema>

export default function TenantOnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep]  = useState(0)
  const [loading, setLoading] = useState(false)

  const profileForm = useForm<ProfileValues>({ resolver: zodResolver(profileSchema) })
  const prefsForm   = useForm<PrefsValues>({ resolver: zodResolver(prefsSchema) })

  async function saveProfile(values: ProfileValues) {
    setLoading(true)
    try {
      await apiClient.patch('/users/profile', values)
      showToast('Profile saved', 'success')
      setStep(1)
    } catch {
      showToast('Failed to save profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function savePrefs(values: PrefsValues) {
    setLoading(true)
    try {
      await apiClient.patch('/users/preferences', values)
      showToast('Preferences saved', 'success')
      navigate('/tenant/dashboard')
    } catch {
      showToast('Failed to save preferences', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900 mb-3">Set up your profile</h1>
        <div className="flex items-center gap-3">
          {['Basic info', 'Preferences'].map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              {i > 0 && <div className={cn('h-px w-8', i <= step ? 'bg-teal-400' : 'bg-gray-200')} />}
              <div className={cn(
                'flex items-center gap-1.5 text-xs font-medium',
                i < step  ? 'text-green-600'
                : i === step ? 'text-teal-600'
                : 'text-gray-400'
              )}>
                {i < step ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Circle className={cn('h-4 w-4', i === step ? 'fill-teal-100' : '')} />
                )}
                {s}
              </div>
            </div>
          ))}
        </div>
      </div>

      {step === 0 && (
        <Card>
          <CardTitle className="mb-4">Basic information</CardTitle>
          <form onSubmit={profileForm.handleSubmit(saveProfile)} className="space-y-4">
            <FormField label="Full name" error={profileForm.formState.errors.fullName?.message} required>
              <Input {...profileForm.register('fullName')} placeholder="Priya Menon" />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Mobile" error={profileForm.formState.errors.phone?.message} required>
                <Input {...profileForm.register('phone')} placeholder="+919876543210" />
              </FormField>
              <FormField label="Date of birth" error={profileForm.formState.errors.dateOfBirth?.message} required>
                <Input {...profileForm.register('dateOfBirth')} type="date" />
              </FormField>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Gender" error={profileForm.formState.errors.gender?.message} required>
                <Select
                  {...profileForm.register('gender')}
                  placeholder="Select"
                  options={[
                    { value: 'MALE',        label: 'Male' },
                    { value: 'FEMALE',      label: 'Female' },
                    { value: 'OTHER',       label: 'Other' },
                    { value: 'PREFER_NOT',  label: 'Prefer not to say' },
                  ]}
                />
              </FormField>
              <FormField label="Profession" error={profileForm.formState.errors.profession?.message} required>
                <Select
                  {...profileForm.register('profession')}
                  placeholder="Select"
                  options={[
                    { value: 'STUDENT',              label: 'Student' },
                    { value: 'WORKING_PROFESSIONAL', label: 'Working professional' },
                    { value: 'OTHER',                label: 'Other' },
                  ]}
                />
              </FormField>
            </div>

            <FormField label="Company / College">
              <Input {...profileForm.register('employerOrCollege')} placeholder="Optional" />
            </FormField>

            <FormField label="City" error={profileForm.formState.errors.city?.message} required>
              <Input {...profileForm.register('city')} placeholder="Hyderabad" />
            </FormField>

            <div className="border-t pt-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Emergency contact</p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <FormField label="Name" error={profileForm.formState.errors.emergencyName?.message} required>
                    <Input {...profileForm.register('emergencyName')} placeholder="Suresh Menon" />
                  </FormField>
                  <FormField label="Relation" error={profileForm.formState.errors.emergencyRelation?.message} required>
                    <Input {...profileForm.register('emergencyRelation')} placeholder="Father" />
                  </FormField>
                </div>
                <FormField label="Phone" error={profileForm.formState.errors.emergencyPhone?.message} required>
                  <Input {...profileForm.register('emergencyPhone')} placeholder="+919876543211" />
                </FormField>
              </div>
            </div>

            <Button type="submit" className="w-full" loading={loading}>
              Continue
            </Button>
          </form>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardTitle className="mb-1">Lifestyle preferences</CardTitle>
          <p className="text-sm text-gray-500 mb-4">
            Used to suggest compatible roommates. Only lifestyle info is shown — never your personal details.
          </p>
          <form onSubmit={prefsForm.handleSubmit(savePrefs)} className="space-y-4">
            {[
              { name: 'smoking'  as const, label: 'Smoking', opts: ['NEVER', 'OCCASIONALLY', 'REGULARLY'] },
              { name: 'drinking' as const, label: 'Drinking', opts: ['NEVER', 'OCCASIONALLY', 'REGULARLY'] },
              { name: 'foodPreference' as const, label: 'Food preference', opts: ['VEG', 'NON_VEG', 'EGGETARIAN', 'JAIN', 'ANY'] },
              { name: 'sleepSchedule' as const, label: 'Sleep schedule', opts: ['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE'] },
              { name: 'cleanlinessLevel' as const, label: 'Cleanliness', opts: ['VERY_CLEAN', 'MODERATE', 'RELAXED'] },
            ].map(({ name, label, opts }) => (
              <FormField key={name} label={label} required>
                <Select
                  {...prefsForm.register(name)}
                  placeholder="Select..."
                  options={opts.map((o) => ({ value: o, label: o.replace('_', ' ') }))}
                />
              </FormField>
            ))}

            <FormField label="About me (shown to potential roommates)">
              <Input
                {...prefsForm.register('compatibilityBio')}
                placeholder="Software engineer, early riser, vegetarian..."
              />
            </FormField>

            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => setStep(0)} className="flex-1">
                Back
              </Button>
              <Button type="submit" className="flex-1" loading={loading}>
                Complete setup
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
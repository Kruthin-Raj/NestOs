import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { useMe } from '@/features/auth/hooks/use-auth'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { QUERY_KEYS } from '@/lib/utils/constants'

const profileSchema = z.object({
  fullName:          z.string().min(2),
  phone:             z.string().regex(/^\+91[6-9]\d{9}$/).optional().or(z.literal('')),
  profession:        z.enum(['STUDENT', 'WORKING_PROFESSIONAL', 'OTHER']).optional(),
  employerOrCollege: z.string().optional(),
  city:              z.string().optional(),
  emergencyName:     z.string().optional(),
  emergencyPhone:    z.string().optional(),
  emergencyRelation: z.string().optional(),
})

const prefsSchema = z.object({
  smoking:          z.string().optional(),
  drinking:         z.string().optional(),
  foodPreference:   z.string().optional(),
  sleepSchedule:    z.string().optional(),
  cleanlinessLevel: z.string().optional(),
  compatibilityBio: z.string().max(500).optional(),
})

export default function TenantSettingsPage() {
  const { data: user } = useMe()
  const qc = useQueryClient()
  const profile = user?.tenantProfile

  const { register: regProfile, handleSubmit: subProfile, formState: { errors: errProfile } } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: profile?.fullName ?? '',
    },
  })

  const { register: regPrefs, handleSubmit: subPrefs } = useForm({
    resolver: zodResolver(prefsSchema),
  })

  const { mutate: saveProfile, isPending: savingProfile } = useMutation({
    mutationFn: (v: unknown) => apiClient.patch('/users/profile', v),
    onSuccess:  () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me() })
      showToast('Profile updated', 'success')
    },
  })

  const { mutate: savePrefs, isPending: savingPrefs } = useMutation({
    mutationFn: (v: unknown) => apiClient.patch('/users/preferences', v),
    onSuccess:  () => {
      showToast('Preferences updated', 'success')
    },
  })

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile and preferences" />

      {/* ID verification */}
      <Card>
        <CardTitle className="mb-3">Identity verification</CardTitle>
        <div className="flex items-center gap-3">
          <StatusBadge status={profile?.status ? 'VERIFIED' : 'PENDING'} />
          <p className="text-sm text-gray-600">
            {profile?.status
              ? 'Your identity is verified'
              : 'Upload your Aadhaar to verify your identity'}
          </p>
        </div>
        {!profile?.status && (
          <div className="mt-3">
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  try {
                    const { data: presigned } = await apiClient.post('/uploads/presigned-url', {
                      documentType: 'AADHAAR_FRONT',
                      fileName:     file.name,
                      mimeType:     file.type,
                      fileSizeBytes: file.size,
                    })
                    await fetch(presigned.data.uploadUrl, {
                      method: 'PUT', body: file,
                      headers: { 'Content-Type': file.type },
                    })
                    await apiClient.post('/uploads/confirm', {
                      fileKey: presigned.data.fileKey,
                      documentType: 'AADHAAR_FRONT',
                      fileName: file.name,
                      fileSizeBytes: file.size,
                      mimeType: file.type,
                    })
                    showToast('Aadhaar uploaded for review', 'success')
                  } catch {
                    showToast('Upload failed', 'error')
                  }
                }}
              />
              <Button size="sm" variant="outline" type="button">
                Upload Aadhaar
              </Button>
            </label>
          </div>
        )}
      </Card>

      {/* Profile */}
      <Card>
        <CardTitle className="mb-4">Profile</CardTitle>
        <form onSubmit={subProfile((v) => saveProfile(v))} className="space-y-4">
          <FormField label="Full name" error={errProfile.fullName?.message} required>
            <Input {...regProfile('fullName')} />
          </FormField>
          <FormField label="Mobile">
            <Input {...regProfile('phone')} placeholder="+919876543210" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Profession">
              <Select
                {...regProfile('profession')}
                placeholder="Select"
                options={[
                  { value: 'STUDENT', label: 'Student' },
                  { value: 'WORKING_PROFESSIONAL', label: 'Working professional' },
                  { value: 'OTHER', label: 'Other' },
                ]}
              />
            </FormField>
            <FormField label="City">
              <Input {...regProfile('city')} />
            </FormField>
          </div>
          <div className="border-t pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">Emergency contact</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Name">
                <Input {...regProfile('emergencyName')} />
              </FormField>
              <FormField label="Relation">
                <Input {...regProfile('emergencyRelation')} />
              </FormField>
              <FormField label="Phone" className="col-span-2">
                <Input {...regProfile('emergencyPhone')} />
              </FormField>
            </div>
          </div>
          <Button type="submit" loading={savingProfile}>Save profile</Button>
        </form>
      </Card>

      {/* Preferences */}
      <Card>
        <CardTitle className="mb-4">Lifestyle preferences</CardTitle>
        <form onSubmit={subPrefs((v) => savePrefs(v))} className="space-y-4">
          {[
            { name: 'smoking'  as const,   label: 'Smoking',     opts: ['NEVER', 'OCCASIONALLY', 'REGULARLY'] },
            { name: 'drinking' as const,   label: 'Drinking',    opts: ['NEVER', 'OCCASIONALLY', 'REGULARLY'] },
            { name: 'foodPreference' as const, label: 'Food',    opts: ['VEG', 'NON_VEG', 'EGGETARIAN', 'JAIN', 'ANY'] },
            { name: 'sleepSchedule' as const, label: 'Sleep',    opts: ['EARLY_BIRD', 'NIGHT_OWL', 'FLEXIBLE'] },
            { name: 'cleanlinessLevel' as const, label: 'Cleanliness', opts: ['VERY_CLEAN', 'MODERATE', 'RELAXED'] },
          ].map(({ name, label, opts }) => (
            <FormField key={name} label={label}>
              <Select
                {...regPrefs(name)}
                placeholder="Select..."
                options={opts.map((o) => ({ value: o, label: o.replace('_', ' ') }))}
              />
            </FormField>
          ))}
          <FormField label="About me (shown to potential roommates)">
            <Textarea {...regPrefs('compatibilityBio')} rows={2} placeholder="Software engineer, early riser..." />
          </FormField>
          <Button type="submit" loading={savingPrefs}>Save preferences</Button>
        </form>
      </Card>
    </div>
  )
}
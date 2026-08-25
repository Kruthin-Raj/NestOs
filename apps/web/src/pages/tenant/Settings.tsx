import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Upload } from 'lucide-react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CitySelect } from '@/components/ui/city-select'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { PhoneInput } from '@/components/ui/phone-input'
import { PageLoader } from '@/components/feedback/loading-state'
import { useProfile, useUpdateProfile, useUpdatePreferences } from '@/features/auth/hooks/use-auth'
import { optionalPhone } from '@/lib/utils/phone'
import { QUERY_KEYS } from '@/lib/utils/constants'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'

const profileSchema = z.object({
  fullName:          z.string().min(2),
  phone:             optionalPhone,
  profession:        z.enum(['STUDENT', 'WORKING_PROFESSIONAL', 'OTHER']).optional(),
  employerOrCollege: z.string().optional(),
  city:              z.string().optional(),
  emergencyName:     z.string().optional(),
  emergencyPhone:    optionalPhone,
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
  const { data: full, isLoading } = useProfile()
  const profile = full?.tenantProfile as Record<string, string | null> | undefined
  const prefs   = full?.preferences  as Record<string, string | null> | undefined

  // `profile.status` is the tenancy lifecycle ("ONBOARDING"), not ID status —
  // reading it here always evaluated truthy, so the page claimed the identity
  // was verified and hid the upload control while isIdVerified was false.
  const idVerified = Boolean(full?.tenantProfile?.isIdVerified)
  const idDocuments = (full?.tenantProfile?.documents ?? []) as Array<{
    status: string; reviewNotes?: string | null
  }>

  // Documents come back newest-first, so the latest one is what the tenant is
  // waiting on. Counting documents instead of reading their status is what left
  // a rejected tenant staring at "waiting for review" forever — a resubmission
  // has to be able to move the state back out of REJECTED, and an old rejected
  // document must not hold the whole card hostage.
  const latestDocument = idDocuments[0]
  const idRejected    = !idVerified && latestDocument?.status === 'REJECTED'
  const idUnderReview = !idVerified && !idRejected && idDocuments.length > 0
  const rejectionReason = idRejected ? latestDocument?.reviewNotes : null

  // `values`, not `defaultValues`: the profile request has not resolved on the
  // first render, and defaultValues is only read once — which is why saved
  // details never showed up and had to be retyped every time.
  const {
    register: regProfile, handleSubmit: subProfile, control,
    formState: { errors: errProfile },
  } = useForm({
    resolver: zodResolver(profileSchema),
    values: {
      fullName:          profile?.fullName          ?? '',
      phone:             profile?.phone             ?? '',
      profession:        (profile?.profession as never) ?? undefined,
      employerOrCollege: profile?.employerOrCollege ?? '',
      city:              profile?.city              ?? '',
      emergencyName:     profile?.emergencyName     ?? '',
      emergencyPhone:    profile?.emergencyPhone    ?? '',
      emergencyRelation: profile?.emergencyRelation ?? '',
    },
  })

  const { register: regPrefs, handleSubmit: subPrefs } = useForm({
    resolver: zodResolver(prefsSchema),
    values: {
      smoking:          prefs?.smoking          ?? '',
      drinking:         prefs?.drinking         ?? '',
      foodPreference:   prefs?.foodPreference   ?? '',
      sleepSchedule:    prefs?.sleepSchedule    ?? '',
      cleanlinessLevel: prefs?.cleanlinessLevel ?? '',
      compatibilityBio: prefs?.compatibilityBio ?? '',
    },
  })

  const { mutate: saveProfile, isPending: savingProfile } = useUpdateProfile()
  const { mutate: savePrefs,   isPending: savingPrefs   } = useUpdatePreferences()

  if (isLoading) return <PageLoader />

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" description="Manage your profile and preferences" />

      {/* ID verification */}
      <Card>
        <CardTitle className="mb-3">Identity verification</CardTitle>
        <div className="flex items-center gap-3">
          <StatusBadge
            status={
              idVerified    ? 'VERIFIED'
              : idRejected  ? 'REJECTED'
              : idUnderReview ? 'UNDER_REVIEW'
              : 'PENDING'
            }
          />
          <p className="text-sm text-gray-600">
            {idVerified
              ? 'Your identity is verified'
              : idRejected
              ? 'Your document was not accepted. Upload a clearer copy to try again.'
              : idUnderReview
              ? 'Your document is uploaded and waiting for review'
              : 'Upload your Aadhaar to verify your identity — booking is locked until then'}
          </p>
        </div>

        {/* The admin's reason. Telling someone "rejected" without saying why
            leaves them guessing at what to change. */}
        {rejectionReason && (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-700">
            <span className="font-medium">Reason: </span>{rejectionReason}
          </p>
        )}

        {!idVerified && (
          <div className="mt-3">
            <AadhaarUpload />
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
          <FormField label="Mobile" error={errProfile.phone?.message}>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <PhoneInput
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={errProfile.phone?.message}
                />
              )}
            />
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
              <Controller
                name="city"
                control={control}
                render={({ field }) => (
                  <CitySelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Select your city..."
                  />
                )}
              />
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
              <FormField
                label="Phone"
                className="col-span-2"
                error={errProfile.emergencyPhone?.message}
              >
                <Controller
                  name="emergencyPhone"
                  control={control}
                  render={({ field }) => (
                    <PhoneInput
                      value={field.value}
                      onChange={field.onChange}
                      onBlur={field.onBlur}
                      error={errProfile.emergencyPhone?.message}
                    />
                  )}
                />
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

/**
 * Aadhaar upload.
 *
 * The file input is triggered from a ref rather than wrapped in a <label>: a
 * <Button> renders a real <button>, and a nested interactive element swallows
 * the label activation, so the picker never opened and the button did nothing.
 */
function AadhaarUpload() {
  const qc = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File) {
    setUploading(true)
    try {
      const { data: presigned } = await apiClient.post('/uploads/presigned-url', {
        documentType:  'AADHAAR_FRONT',
        fileName:      file.name,
        mimeType:      file.type,
        fileSizeBytes: file.size,
      })

      const put = await fetch(presigned.data.uploadUrl, {
        method:  'PUT',
        body:    file,
        headers: { 'Content-Type': file.type },
      })
      if (!put.ok) throw new Error('upload failed')

      await apiClient.post('/uploads/confirm', {
        fileKey:       presigned.data.fileKey,
        documentType:  'AADHAAR_FRONT',
        fileName:      file.name,
        fileSizeBytes: file.size,
        mimeType:      file.type,
      })

      // Refresh so the card flips to "waiting for review" straight away.
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.profile() })
      showToast('Aadhaar uploaded — an admin will review it shortly', 'success')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Upload failed. Please try again.', 'error')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
      <Button
        size="sm"
        variant="outline"
        type="button"
        loading={uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Upload className="h-4 w-4 mr-1" /> Upload Aadhaar
      </Button>
      <p className="text-xs text-gray-400 mt-2">
        JPG, PNG, WEBP or PDF, up to 10 MB. Only you and a NestOS admin can view it.
      </p>
    </>
  )
}

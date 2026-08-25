import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, Circle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { PhoneInput } from '@/components/ui/phone-input'
import { requiredPhone } from '@/lib/utils/phone'
import { useProfile } from '@/features/auth/hooks/use-auth'
import { CitySelect } from '@/components/ui/city-select'
import { Card, CardTitle } from '@/components/ui/card'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils/cn'

const profileSchema = z.object({
  fullName:     z.string().min(2, 'Enter your full name'),
  businessName: z.string().optional(),
  city:         z.string().min(2, 'Enter your city'),
  state:        z.string().min(2, 'Enter your state'),
  phone:        requiredPhone,
})
type ProfileValues = z.infer<typeof profileSchema>

const STEPS = [
  { id: 'profile',   label: 'Profile details' },
  { id: 'documents', label: 'Identity documents' },
  { id: 'property',  label: 'Property documents' },
  { id: 'submit',    label: 'Submit for review' },
]

export default function OwnerOnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep]  = useState(0)
  const [loading, setLoading] = useState(false)

  const { data: full } = useProfile()
  const saved = full?.ownerProfile as Record<string, string | null> | undefined

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    // Prefill anything already stored so returning to onboarding does not mean
    // retyping everything. `values` re-syncs once the request resolves.
    values: {
      fullName:     saved?.fullName     ?? '',
      businessName: saved?.businessName ?? '',
      city:         saved?.city         ?? '',
      state:        saved?.state        ?? '',
      phone:        full?.user?.phone   ?? '',
    },
  })

  async function onProfileSubmit(values: ProfileValues) {
    setLoading(true)
    try {
      await apiClient.patch('/users/profile', values)
      showToast('Profile saved', 'success')
      setStep(1)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to save profile', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress steps */}
      <div className="mb-8">
        <h1 className="text-xl font-bold text-gray-900 mb-4">
          Set up your owner account
        </h1>
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={cn(
                'flex items-center gap-1.5 text-xs font-medium',
                i < step  ? 'text-green-600'
                : i === step ? 'text-indigo-600'
                : 'text-gray-400'
              )}>
                {i < step ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Circle className={cn('h-4 w-4', i === step ? 'fill-indigo-100' : '')} />
                )}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn('h-px flex-1 min-w-[16px]', i < step ? 'bg-green-300' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step 0: Profile */}
      {step === 0 && (
        <Card>
          <CardTitle className="mb-4">Your profile details</CardTitle>
          <form onSubmit={handleSubmit(onProfileSubmit)} className="space-y-4">
            <FormField label="Full name" error={errors.fullName?.message} required>
              <Input {...register('fullName')} placeholder="Ramesh Sharma" />
            </FormField>
            <FormField label="Business / firm name" error={errors.businessName?.message}>
              <Input {...register('businessName')} placeholder="Sharma PG Enterprises (optional)" />
            </FormField>
            <div className="grid grid-cols-2 gap-4">
              <FormField label="City" error={errors.city?.message} required>
                <Controller
                  name="city"
                  control={control}
                  render={({ field }) => (
                    <CitySelect
                      value={field.value ?? ''}
                      onChange={field.onChange}
                      onSelectState={(s) => setValue('state', s, { shouldValidate: true })}
                      error={!!errors.city}
                    />
                  )}
                />
              </FormField>
              <FormField label="State" error={errors.state?.message} required>
                <Input {...register('state')} placeholder="Telangana" />
              </FormField>
            </div>
            <FormField label="Mobile number" error={errors.phone?.message} required>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={field.value}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    error={errors.phone?.message}
                  />
                )}
              />
            </FormField>
            <Button type="submit" className="w-full" loading={loading}>
              Save and continue
            </Button>
          </form>
        </Card>
      )}

      {/* Step 1-2: Documents */}
      {(step === 1 || step === 2) && (
        <OnboardingDocStep
          step={step}
          onNext={() => setStep(step + 1)}
          onBack={() => setStep(step - 1)}
        />
      )}

      {/* Step 3: Submit */}
      {step === 3 && (
        <OnboardingSubmitStep
          onSubmit={async () => {
            setLoading(true)
            try {
              await apiClient.post('/owner/verification/submit', {
                panNumber:     'ABCDE1234F',  // user fills in real flow
                aadhaarNumber: '000000000000',
              })
              showToast('Submitted for review!', 'success')
              navigate('/owner/dashboard')
            } catch (err: unknown) {
              const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
              showToast(msg ?? 'Submission failed', 'error')
            } finally {
              setLoading(false)
            }
          }}
          onBack={() => setStep(2)}
          loading={loading}
        />
      )}
    </div>
  )
}

function OnboardingDocStep({
  step, onNext, onBack
}: {
  step: number; onNext: () => void; onBack: () => void
}) {
  const isIdentity = step === 1
  const docs = isIdentity
    ? [
        { type: 'AADHAAR_FRONT', label: 'Aadhaar Card (Front)' },
        { type: 'AADHAAR_BACK',  label: 'Aadhaar Card (Back)' },
        { type: 'PAN_CARD',      label: 'PAN Card' },
        { type: 'SELFIE',        label: 'Selfie / Photo' },
      ]
    : [
        { type: 'PROPERTY_DEED',    label: 'Property deed / ownership document' },
        { type: 'UTILITY_BILL',     label: 'Utility bill (electricity / water)' },
        { type: 'LEASE_AGREEMENT',  label: 'Lease agreement (if applicable)' },
      ]

  const [uploaded, setUploaded] = useState<Record<string, boolean>>({})

  async function handleUpload(docType: string, file: File) {
    try {
      const { data: presigned } = await apiClient.post('/uploads/presigned-url', {
        documentType:  docType,
        fileName:      file.name,
        mimeType:      file.type,
        fileSizeBytes: file.size,
      })
      const { uploadUrl, fileKey } = presigned.data

      await fetch(uploadUrl, {
        method:  'PUT',
        body:    file,
        headers: { 'Content-Type': file.type },
      })

      await apiClient.post('/uploads/confirm', {
        fileKey,
        documentType:  docType,
        fileName:      file.name,
        fileSizeBytes: file.size,
        mimeType:      file.type,
      })

      setUploaded((prev) => ({ ...prev, [docType]: true }))
      showToast('Document uploaded', 'success')
    } catch {
      showToast('Upload failed. Please try again.', 'error')
    }
  }

  return (
    <Card>
      <CardTitle className="mb-1">
        {isIdentity ? 'Identity documents' : 'Property documents'}
      </CardTitle>
      <p className="text-sm text-gray-500 mb-4">
        {isIdentity
          ? 'Upload your government ID for verification'
          : 'Upload at least one document proving you own or manage this property'
        }
      </p>

      <div className="space-y-3 mb-6">
        {docs.map((doc) => (
          <div
            key={doc.type}
            className={cn(
              'flex items-center justify-between p-3 rounded-lg border',
              uploaded[doc.type]
                ? 'border-green-300 bg-green-50'
                : 'border-gray-200'
            )}
          >
            <div className="flex items-center gap-2">
              {uploaded[doc.type] ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : (
                <FileText className="h-4 w-4 text-gray-400" />
              )}
              <span className="text-sm text-gray-700">{doc.label}</span>
            </div>
            <label className="cursor-pointer">
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (file) handleUpload(doc.type, file)
                }}
              />
              <span className={cn(
                'text-xs px-2 py-1 rounded border',
                uploaded[doc.type]
                  ? 'border-green-400 text-green-700'
                  : 'border-indigo-300 text-indigo-600 hover:bg-indigo-50'
              )}>
                {uploaded[doc.type] ? 'Replace' : 'Upload'}
              </span>
            </label>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Back
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continue
        </Button>
      </div>
    </Card>
  )
}

function OnboardingSubmitStep({
  onSubmit, onBack, loading
}: {
  onSubmit: () => void; onBack: () => void; loading: boolean
}) {
  return (
    <Card>
      <div className="text-center py-4">
        <div className="w-14 h-14 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-7 w-7 text-indigo-600" />
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">
          Ready to submit
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          Your documents will be reviewed within 2 business days. Once verified,
          your buildings will go live and tenants can find you.
        </p>
        <div className="space-y-2 text-left bg-gray-50 rounded-lg p-4 mb-6">
          <p className="text-xs font-medium text-gray-700">What happens next:</p>
          <p className="text-xs text-gray-600">✓ Admin reviews your documents</p>
          <p className="text-xs text-gray-600">✓ You receive an approval email</p>
          <p className="text-xs text-gray-600">✓ Add buildings and go live</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1" disabled={loading}>
            Back
          </Button>
          <Button onClick={onSubmit} className="flex-1" loading={loading}>
            Submit for Review
          </Button>
        </div>
      </div>
    </Card>
  )
}
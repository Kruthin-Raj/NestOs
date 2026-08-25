import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PhoneInput } from '@/components/ui/phone-input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { PageLoader } from '@/components/feedback/loading-state'
import { useMe, useProfile, useUpdateProfile } from '@/features/auth/hooks/use-auth'
import { CitySelect } from '@/components/ui/city-select'
import { optionalPhone } from '@/lib/utils/phone'

const schema = z.object({
  fullName:     z.string().min(2, 'Enter your full name'),
  businessName: z.string().optional(),
  phone:        optionalPhone,
  upiId:        z.string().optional(),
  city:         z.string().optional(),
  state:        z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function OwnerSettingsPage() {
  const { data: user } = useMe()
  const { data: full, isLoading } = useProfile()
  const { mutate, isPending } = useUpdateProfile()

  const profile = full?.ownerProfile as Record<string, string | null> | undefined

  const { register, handleSubmit, control, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    // `values` (not `defaultValues`) — defaultValues is only read on the first
    // render, which happens before the profile request resolves. That is why
    // saved details never appeared and had to be retyped every visit.
    values: {
      fullName:     profile?.fullName     ?? '',
      businessName: profile?.businessName ?? '',
      phone:        full?.user?.phone     ?? '',
      upiId:        profile?.upiId        ?? '',
      city:         profile?.city         ?? '',
      state:        profile?.state        ?? '',
    },
  })

  if (isLoading) return <PageLoader />

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      {/* Verification status */}
      <Card>
        <CardTitle className="mb-3">Verification status</CardTitle>
        <div className="flex items-center gap-3">
          <StatusBadge status={(profile?.verificationStatus as never) ?? 'PENDING'} />
          <p className="text-sm text-gray-600">
            {profile?.verificationStatus === 'VERIFIED'
              ? 'Your account is fully verified'
              : profile?.verificationStatus === 'UNDER_REVIEW'
              ? 'Your documents are being reviewed'
              : 'Complete verification to go live'}
          </p>
        </div>
        {profile?.verificationStatus !== 'VERIFIED' && (
          <a
            href="/owner/onboarding"
            className="inline-block mt-2 text-sm text-indigo-600 hover:underline"
          >
            Continue verification →
          </a>
        )}
      </Card>

      {/* Profile form */}
      <Card>
        <CardTitle className="mb-4">Profile details</CardTitle>
        <form onSubmit={handleSubmit((v) => mutate(v))} className="space-y-4">
          <FormField label="Full name" error={errors.fullName?.message} required>
            <Input {...register('fullName')} />
          </FormField>
          <FormField label="Business name">
            <Input {...register('businessName')} placeholder="Optional" />
          </FormField>
          <FormField label="Mobile number" error={errors.phone?.message}>
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
          <FormField
            label="UPI ID"
            error={errors.upiId?.message}
            hint="Required to collect rent — tenants pay this address directly"
          >
            <Input {...register('upiId')} placeholder="yourname@okhdfcbank" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="City">
              <Controller
                name="city"
                control={control}
                render={({ field }) => (
                  <CitySelect
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    onSelectState={(state) => setValue('state', state)}
                    placeholder="Select city..."
                  />
                )}
              />
            </FormField>
            <FormField label="State">
              <Input {...register('state')} placeholder="Auto-filled" />
            </FormField>
          </div>
          <Button type="submit" loading={isPending}>
            Save changes
          </Button>
        </form>
      </Card>

      {/* Account info */}
      <Card>
        <CardTitle className="mb-3">Account</CardTitle>
        <p className="text-sm text-gray-600">{user?.email}</p>
        <p className="text-xs text-gray-400 mt-1">Email cannot be changed</p>
      </Card>
    </div>
  )
}

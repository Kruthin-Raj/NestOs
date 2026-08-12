import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { useMe } from '@/features/auth/hooks/use-auth'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { QUERY_KEYS } from '@/lib/utils/constants'

const schema = z.object({
  fullName:     z.string().min(2),
  businessName: z.string().optional(),
  phone:        z.string().regex(/^\+91[6-9]\d{9}$/, 'Enter valid Indian mobile').optional().or(z.literal('')),
  city:         z.string().optional(),
  state:        z.string().optional(),
})
type FormValues = z.infer<typeof schema>

export default function OwnerSettingsPage() {
  const { data: user } = useMe()
  const qc = useQueryClient()
  const profile = user?.ownerProfile

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName:     profile?.fullName ?? '',
      businessName: profile?.businessName ?? '',
    },
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (v: FormValues) => apiClient.patch('/users/profile', v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me() })
      showToast('Profile updated', 'success')
    },
    onError: () => showToast('Update failed', 'error'),
  })

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Settings" description="Manage your account and preferences" />

      {/* Verification status */}
      <Card>
        <CardTitle className="mb-3">Verification status</CardTitle>
        <div className="flex items-center gap-3">
          <StatusBadge status={profile?.verificationStatus ?? 'PENDING'} />
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
            <Input {...register('phone')} placeholder="+919876543210" />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="City">
              <Input {...register('city')} />
            </FormField>
            <FormField label="State">
              <Input {...register('state')} />
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
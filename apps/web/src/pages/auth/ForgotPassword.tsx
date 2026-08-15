import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card } from '@/components/ui/card'
import { forgotPassword, resetPassword } from '@/features/auth/services/auth.service'
import { useAuthStore } from '@/store/auth.store'
import { showToast } from '@/components/ui/toaster'
import { HOME_BY_ROLE } from '@/lib/utils/auth-routes'
import { passwordField } from '@/lib/utils/password'

const emailSchema = z.object({
  email: z.string().email('Enter a valid email address'),
})
type EmailValues = z.infer<typeof emailSchema>

const resetSchema = z.object({
  otp:      z.string().length(6, 'Enter the 6-digit code').regex(/^\d{6}$/, 'Digits only'),
  password: passwordField,
})
type ResetValues = z.infer<typeof resetSchema>

/**
 * Two steps: request a code, then set a new password with it.
 *
 * Also the route for an account that has never had a password — every account
 * created before password login, including the seeded admin.
 */
export default function ForgotPasswordPage() {
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState(searchParams.get('email') ?? '')
  const [step, setStep]   = useState<'email' | 'reset'>('email')

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">
          {step === 'email' ? 'Reset your password' : 'Choose a new password'}
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          {step === 'email'
            ? 'We will email you a 6-digit code'
            : `Enter the code we sent to ${email}`}
        </p>
      </div>

      <Card>
        {step === 'email' ? (
          <RequestCodeForm
            initialEmail={email}
            onSent={(value) => { setEmail(value); setStep('reset') }}
          />
        ) : (
          <ResetForm email={email} />
        )}
      </Card>

      <p className="text-center text-sm text-gray-500">
        Remembered it?{' '}
        <Link to="/login" className="text-indigo-600 font-medium hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  )
}

function RequestCodeForm({
  initialEmail,
  onSent,
}: {
  initialEmail: string
  onSent: (email: string) => void
}) {
  const [loading, setLoading] = useState(false)
  const { register, handleSubmit, formState: { errors } } = useForm<EmailValues>({
    resolver: zodResolver(emailSchema),
    values:   { email: initialEmail },
  })

  async function onSubmit(values: EmailValues) {
    setLoading(true)
    try {
      await forgotPassword(values.email)
      // The API deliberately does not say whether the address is registered.
      showToast('If that email is registered, a code is on its way', 'success')
      onSent(values.email)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not send the code', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="Email address" error={errors.email?.message} required>
        <Input
          {...register('email')}
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          autoFocus
        />
      </FormField>
      <Button type="submit" className="w-full" loading={loading}>
        Send code
      </Button>
    </form>
  )
}

function ResetForm({ email }: { email: string }) {
  const navigate = useNavigate()
  const setUser  = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<ResetValues>({
    resolver: zodResolver(resetSchema),
  })

  async function onSubmit(values: ResetValues) {
    setLoading(true)
    try {
      const result = await resetPassword(email, values.otp, values.password)
      setUser(result.user)
      showToast('Password updated — you are signed in', 'success')
      navigate(HOME_BY_ROLE[result.user.role] || '/')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Could not reset your password', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField label="6-digit code" error={errors.otp?.message} required>
        <Input
          {...register('otp')}
          inputMode="numeric"
          maxLength={6}
          placeholder="123456"
          autoComplete="one-time-code"
          autoFocus
        />
      </FormField>

      <FormField
        label="New password"
        error={errors.password?.message}
        required
        hint="At least 8 characters, with a letter and a number"
      >
        <Input
          {...register('password')}
          type="password"
          placeholder="••••••••"
          autoComplete="new-password"
        />
      </FormField>

      <Button type="submit" className="w-full" loading={loading}>
        Set password and sign in
      </Button>
    </form>
  )
}

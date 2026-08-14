import { useState } from 'react'
import { useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card } from '@/components/ui/card'
import { login } from '@/features/auth/services/auth.service'
import { useAuthStore } from '@/store/auth.store'
import { showToast } from '@/components/ui/toaster'
import { HOME_BY_ROLE } from '@/lib/utils/auth-routes'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect = searchParams.get('redirect') ?? ''
  const setUser  = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const result = await login(values.email, values.password)
      setUser(result.user)
      showToast('Welcome back', 'success')
      navigate(redirect || HOME_BY_ROLE[result.user.role] || '/')
    } catch (err: unknown) {
      const data = (err as { response?: { data?: { message?: string; error?: { code?: string } } } })
        ?.response?.data
      const code = data?.error?.code

      // Accounts created before password login have no password yet, and an
      // unverified signup still needs its emailed code — both are recoverable,
      // so send the user straight to the right place instead of a dead end.
      if (code === 'PASSWORD_NOT_SET') {
        showToast('Set a password to continue — we will email you a code.', 'info')
        navigate(`/forgot-password?email=${encodeURIComponent(values.email)}`)
        return
      }
      if (code === 'EMAIL_NOT_VERIFIED') {
        showToast('Verify your email first — check your inbox for the code.', 'info')
        navigate(`/verify-otp?email=${encodeURIComponent(values.email)}`)
        return
      }

      showToast(data?.message ?? 'Could not sign in', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">Sign in with your email and password</p>
      </div>

      <Card>
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

          <FormField label="Password" error={errors.password?.message} required>
            <Input
              {...register('password')}
              type="password"
              placeholder="••••••••"
              autoComplete="current-password"
            />
          </FormField>

          <div className="flex justify-end">
            <Link
              to={`/forgot-password?email=${encodeURIComponent(getValues('email') ?? '')}`}
              className="text-sm text-indigo-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>
      </Card>

      <p className="text-center text-sm text-gray-500">
        New to NestOS?{' '}
        <Link to="/signup" className="text-indigo-600 font-medium hover:underline">
          Create an account
        </Link>
      </p>

      {/* Role info */}
      <div className="grid grid-cols-2 gap-3 mt-6">
        <div className="flex items-center gap-2 p-3 bg-indigo-50 rounded-lg">
          <Building2 className="h-4 w-4 text-indigo-600 flex-shrink-0" />
          <p className="text-xs text-indigo-700">Manage your PG or hostel</p>
        </div>
        <div className="flex items-center gap-2 p-3 bg-teal-50 rounded-lg">
          <Users className="h-4 w-4 text-teal-600 flex-shrink-0" />
          <p className="text-xs text-teal-700">Find and book a PG</p>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Building2, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'
import { Card } from '@/components/ui/card'
import { sendOtp } from '@/features/auth/services/auth.service'
import { showToast } from '@/components/ui/toaster'

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
})
type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const redirect     = searchParams.get('redirect') ?? ''
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      await sendOtp(values.email)
      showToast('OTP sent to your email', 'success')
      navigate(
        `/verify-otp?email=${encodeURIComponent(values.email)}&redirect=${encodeURIComponent(redirect)}`
      )
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to send OTP', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Welcome back</h1>
        <p className="mt-1 text-sm text-gray-500">
          Sign in with your email — we'll send you a code
        </p>
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

          <Button type="submit" className="w-full" loading={loading}>
            Send OTP
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
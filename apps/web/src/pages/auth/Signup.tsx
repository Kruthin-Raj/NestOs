import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link } from 'react-router-dom'
import { Building2, Users, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { signup } from '@/features/auth/services/auth.service'
import { passwordField } from '@/lib/utils/password'
import { showToast } from '@/components/ui/toaster'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form-field'

type RoleOption = 'OWNER' | 'TENANT'

const schema = z.object({
  email:    z.string().email('Enter a valid email address'),
  password: passwordField,
})
type FormValues = z.infer<typeof schema>

const ROLES: Array<{
  value: RoleOption
  title: string
  desc:  string
  icon:  React.ReactNode
  color: string
  bg:    string
}> = [
  {
    value: 'OWNER',
    title: 'Property Owner / Admin',
    desc:  'Manage PGs, hostels, apartments and collect rent',
    icon:  <Building2 className="h-6 w-6" />,
    color: 'text-indigo-600 border-indigo-600',
    bg:    'bg-indigo-50',
  },
  {
    value: 'TENANT',
    title: 'Looking for a PG',
    desc:  'Search, book and manage your stay',
    icon:  <Users className="h-6 w-6" />,
    color: 'text-teal-600 border-teal-600',
    bg:    'bg-teal-50',
  },
]

export default function SignupPage() {
  const navigate = useNavigate()
  const [role, setRole]  = useState<RoleOption | null>(null)
  const [step, setStep]  = useState<'role' | 'email'>('role')
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    if (!role) return
    setLoading(true)
    try {
      await signup(values.email, values.password, role)
      showToast('Account created — enter the code we emailed you', 'success')
      navigate(
        `/verify-otp?email=${encodeURIComponent(values.email)}&role=${role}&isNew=1`
      )
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { message?: string; error?: { code?: string } } } })?.response?.data
      const code = errData?.error?.code
      if (code === 'ROLE_MISMATCH') {
        showToast('This email is already registered with a different role. Please log in instead.', 'error')
      } else if (code === 'EMAIL_IN_USE') {
        showToast('That email already has an account — sign in instead.', 'error')
        navigate(`/login?email=${encodeURIComponent(values.email)}`)
      } else {
        showToast(errData?.message ?? 'Could not create your account', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">
          {step === 'role' ? 'How will you use NestOS?' : 'Choose an email and password'}
        </p>
      </div>

      {step === 'role' && (
        <div className="space-y-3">
          {ROLES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => { setRole(r.value); setStep('email') }}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all text-left',
                role === r.value
                  ? r.color
                  : 'border-gray-200 hover:border-gray-300'
              )}
            >
              <div className={cn('p-2 rounded-lg flex-shrink-0', r.bg)}>
                <span className={role === r.value ? r.color.split(' ')[0] : 'text-gray-600'}>
                  {r.icon}
                </span>
              </div>
              <div className="flex-1">
                <p className="font-medium text-gray-900">{r.title}</p>
                <p className="text-sm text-gray-500">{r.desc}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          ))}
        </div>
      )}

      {step === 'email' && role && (
        <Card>
          <div className="mb-4 flex items-center gap-3">
            <div className={cn(
              'p-2 rounded-lg',
              role === 'OWNER' ? 'bg-indigo-50 text-indigo-600' : 'bg-teal-50 text-teal-600'
            )}>
              {ROLES.find((r) => r.value === role)?.icon}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">
                {ROLES.find((r) => r.value === role)?.title}
              </p>
              <button
                onClick={() => setStep('role')}
                className="text-xs text-indigo-600 hover:underline"
              >
                Change
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormField label="Email address" error={errors.email?.message} required>
              <Input
                {...register('email')}
                type="email"
                placeholder="you@example.com"
                autoFocus
              />
            </FormField>
            <FormField
              label="Password"
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
              Create account
            </Button>
            <p className="text-xs text-gray-400 text-center">
              We will email you a 6-digit code to confirm your address.
            </p>
          </form>
        </Card>
      )}

      <p className="text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-indigo-600 font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  )
}
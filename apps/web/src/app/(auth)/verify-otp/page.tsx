'use client'
import { useState, useRef, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { verifyOtp, sendOtp } from '@/features/auth/services/auth.service'
import { useAuthStore } from '@/store/auth.store'
import { showToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils/cn'

export default function VerifyOtpPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const email        = searchParams.get('email') ?? ''
  const role         = searchParams.get('role') ?? undefined
  const isNew        = searchParams.get('isNew') === '1'
  const redirect     = searchParams.get('redirect') ?? ''

  const setUser  = useAuthStore((s) => s.setUser)
  const [loading, setLoading] = useState(false)
  const [resending, setResending] = useState(false)
  const [countdown, setCountdown] = useState(60)
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const inputRefs = useRef<Array<HTMLInputElement | null>>(Array(6).fill(null))

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  function handleDigitChange(index: number, value: string) {
    const digit = value.replace(/\D/g, '').slice(-1)
    const next  = [...digits]
    next[index] = digit
    setDigits(next)
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    if (next.every((d) => d !== '') && next.join('').length === 6) {
      handleSubmit(next.join(''))
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  async function handleSubmit(otp: string) {
    setLoading(true)
    try {
      const result = await verifyOtp(email, otp, role)
      setUser(result.user)
      showToast('Welcome to NestOS!', 'success')

      if (result.user.isNewUser) {
        if (result.user.role === 'OWNER') {
          navigate('/owner/onboarding')
        } else {
          navigate('/tenant/onboarding')
        }
      } else if (redirect) {
        navigate(redirect)
      } else {
        navigate(
          result.user.role === 'OWNER' ? '/owner/dashboard' : '/tenant/dashboard'
        )
      }
    } catch (err: unknown) {
      const errData = (err as { response?: { data?: { message?: string } } })?.response?.data
      showToast(errData?.message ?? 'Invalid OTP. Please try again.', 'error')
      setDigits(Array(6).fill(''))
      inputRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  async function resend() {
    setResending(true)
    try {
      await sendOtp(email, role)
      setCountdown(60)
      setDigits(Array(6).fill(''))
      showToast('New OTP sent', 'success')
    } catch {
      showToast('Failed to resend OTP', 'error')
    } finally {
      setResending(false)
    }
  }

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-gray-900">Enter your OTP</h1>
        <p className="mt-1 text-sm text-gray-500">
          We sent a 6-digit code to{' '}
          <span className="font-medium text-gray-700">{email}</span>
        </p>
      </div>

      <Card>
        <div className="flex justify-center gap-2 mb-6">
          {digits.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputRefs.current[i] = el }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleDigitChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              disabled={loading}
              className={cn(
                'w-12 h-14 text-center text-xl font-bold border-2 rounded-xl',
                'focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
                digit ? 'border-indigo-500 text-indigo-700' : 'border-gray-300',
                'transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            />
          ))}
        </div>

        <Button
          className="w-full"
          onClick={() => handleSubmit(digits.join(''))}
          loading={loading}
          disabled={digits.join('').length < 6}
        >
          Verify OTP
        </Button>

        <div className="mt-4 text-center">
          {countdown > 0 ? (
            <p className="text-sm text-gray-500">
              Resend OTP in <span className="font-medium">{countdown}s</span>
            </p>
          ) : (
            <button
              onClick={resend}
              disabled={resending}
              className="text-sm text-indigo-600 font-medium hover:underline disabled:opacity-50"
            >
              {resending ? 'Sending...' : 'Resend OTP'}
            </button>
          )}
        </div>
      </Card>
    </div>
  )
}
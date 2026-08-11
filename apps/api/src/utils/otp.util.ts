import bcrypt from 'bcryptjs'
import { OTP } from '@config/constants'

export function generateOtp(): string {
  const min = 100000
  const max = 999999
  return String(Math.floor(Math.random() * (max - min + 1)) + min)
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, 10)
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash)
}

export function getOtpExpiry(minutes?: number): Date {
  const expiryMinutes = minutes ?? OTP.EXPIRY_MINUTES
  return new Date(Date.now() + expiryMinutes * 60 * 1000)
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@')
  if (!local || !domain) return email
  const visible = local.substring(0, 2)
  return `${visible}***@${domain}`
}
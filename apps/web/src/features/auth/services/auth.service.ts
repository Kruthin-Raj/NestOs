import apiClient from '@/lib/api/client'
import type { ApiResponse, User } from '@/types'

interface SessionResponse {
  user: User & { isNewUser?: boolean }
  accessToken: string
  expiresIn: number
}

interface OtpSentResponse {
  identifier: string
  expiresInSeconds: number
  maskedEmail: string
}

/** Creates the account with a password; a code is emailed to confirm the address. */
export async function signup(email: string, password: string, role: string) {
  const { data } = await apiClient.post<ApiResponse<OtpSentResponse>>(
    '/auth/signup',
    { email, password, role }
  )
  return data.data
}

/** Day-to-day sign in. No OTP involved. */
export async function login(email: string, password: string) {
  const { data } = await apiClient.post<ApiResponse<SessionResponse>>(
    '/auth/login',
    { email, password }
  )
  return data.data
}

/** Emails a reset code. Always succeeds, even for an unknown address. */
export async function forgotPassword(email: string) {
  const { data } = await apiClient.post<ApiResponse<OtpSentResponse>>(
    '/auth/forgot-password',
    { email }
  )
  return data.data
}

/** Sets a new password using the emailed code, and signs the user in. */
export async function resetPassword(email: string, otp: string, password: string) {
  const { data } = await apiClient.post<ApiResponse<SessionResponse>>(
    '/auth/reset-password',
    { email, otp, password }
  )
  return data.data
}

export async function sendOtp(email: string, role?: string) {
  const { data } = await apiClient.post<ApiResponse<{
    identifier: string
    expiresInSeconds: number
    maskedEmail: string
  }>>('/auth/send-otp', { email, role })
  return data.data
}

export async function verifyOtp(email: string, otp: string, role?: string) {
  const { data } = await apiClient.post<ApiResponse<{
    user: User & { isNewUser: boolean }
    accessToken: string
    expiresIn: number
  }>>('/auth/verify-otp', { email, otp, role })
  return data.data
}

export async function getMe() {
  const { data } = await apiClient.get<ApiResponse<User>>('/auth/me')
  return data.data
}

export async function logout() {
  await apiClient.post('/auth/logout')
}
export async function updateProfile(values: unknown) {
  const { data } = await apiClient.patch<ApiResponse<User>>('/users/profile', values)
  return data.data
}

export async function updatePreferences(values: unknown) {
  const { data } = await apiClient.patch<ApiResponse<unknown>>('/users/preferences', values)
  return data.data
}

export interface FullProfile {
  user: {
    id: string
    email: string
    role: 'SUPER_ADMIN' | 'OWNER' | 'TENANT'
    isEmailVerified: boolean
    isPhoneVerified: boolean
    phone?: string | null
  }
  ownerProfile?: Record<string, unknown> | null
  tenantProfile?: Record<string, unknown> | null
  preferences?: Record<string, unknown> | null
}

/**
 * The complete profile record. /auth/me only returns a summary, which is why
 * the settings and onboarding forms could never prefill what was in the
 * database.
 */
export async function getProfile() {
  const { data } = await apiClient.get<ApiResponse<FullProfile>>('/users/profile')
  return data.data
}

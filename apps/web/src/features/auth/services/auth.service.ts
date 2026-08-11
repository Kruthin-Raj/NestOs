import apiClient from '@/lib/api/client'
import type { ApiResponse, User } from '@/types'

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
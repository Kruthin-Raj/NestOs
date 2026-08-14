import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMe, logout, updateProfile, updatePreferences, getProfile } from '../services/auth.service'
import { useAuthStore } from '@/store/auth.store'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { showToast } from '@/components/ui/toaster'

export function useMe() {
  const setUser = useAuthStore((s) => s.setUser)
  return useQuery({
    queryKey: QUERY_KEYS.auth.me(),
    queryFn:  async () => {
      const user = await getMe()
      setUser(user)
      return user
    },
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

export function useLogout() {
  const navigate = useNavigate()
  const clearSession = useAuthStore((s) => s.clearSession)
  const qc          = useQueryClient()

  return useMutation({
    mutationFn: logout,
    onSuccess:  () => {
      clearSession()
      qc.clear()
      navigate('/login')
    },
    onError: () => {
      clearSession()
      navigate('/login')
    },
  })
}
/**
 * Shared by the owner and tenant settings pages, which previously repeated an
 * identical mutation. The onboarding wizards deliberately do not use this —
 * they advance a step on success and need their own control flow.
 */
export function useUpdateProfile() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: updateProfile,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me() })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.profile() })
      showToast('Profile updated', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Update failed', 'error')
    },
  })
}

export function useUpdatePreferences() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: updatePreferences,
    onSuccess: () => {
      // Preferences come back from /users/profile, so this must be refreshed or
      // the form reverts to stale values on the next visit.
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.profile() })
      showToast('Preferences updated', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Update failed', 'error')
    },
  })
}

/** Full profile for the settings and onboarding forms. See getProfile(). */
export function useProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.auth.profile(),
    queryFn:  getProfile,
    staleTime: 60 * 1000,
  })
}

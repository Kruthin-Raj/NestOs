import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getMe, logout } from '../services/auth.service'
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
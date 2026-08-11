import { useQuery } from '@tanstack/react-query'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS } from '@/lib/utils/constants'

export function useOwnerDashboard(buildingId?: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.dashboard.owner(), buildingId],
    queryFn:  async () => {
      const params = buildingId ? `?buildingId=${buildingId}` : ''
      const { data } = await apiClient.get(`/owner/dashboard/owner${params}`)
      return data.data
    },
  })
}
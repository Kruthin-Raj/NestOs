import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { QUERY_KEYS } from '@/lib/utils/constants'
import {
  getBuildings, getBuilding, createBuilding,
  updateBuilding, updateBuildingStatus, deleteBuilding,
} from '../services/buildings.service'
import { showToast } from '@/components/ui/toaster'

export function useBuildings(params?: Record<string, unknown>) {
  return useQuery({
    queryKey: QUERY_KEYS.buildings.list(params),
    queryFn:  () => getBuildings(params),
  })
}

export function useBuilding(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.buildings.detail(id),
    queryFn:  () => getBuilding(id),
    enabled:  !!id,
  })
}

export function useCreateBuilding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createBuilding,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.all() })
      showToast('Building created', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to create building', 'error')
    },
  })
}

export function useUpdateBuilding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: unknown }) =>
      updateBuilding(id, payload),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.detail(id) })
      showToast('Building updated', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Update failed', 'error')
    },
  })
}

export function useUpdateBuildingStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'ACTIVE' | 'INACTIVE' }) =>
      updateBuildingStatus(id, status),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.detail(id) })
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.all() })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Status update failed', 'error')
    },
  })
}

export function useDeleteBuilding() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteBuilding,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.buildings.all() })
      showToast('Building removed', 'success')
    },
  })
}
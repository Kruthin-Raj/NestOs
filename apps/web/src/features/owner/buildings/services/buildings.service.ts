import apiClient from '@/lib/api/client'
import type { Building, ApiResponse, PaginatedData } from '@/types'

export async function getBuildings(params?: Record<string, unknown>) {
  const query = params ? '?' + new URLSearchParams(params as Record<string, string>).toString() : ''
  const { data } = await apiClient.get<ApiResponse<PaginatedData<Building> & { summary: unknown }>>(`/buildings${query}`)
  return data.data
}

export async function getBuilding(id: string) {
  const { data } = await apiClient.get<ApiResponse<Building>>(`/buildings/${id}`)
  return data.data
}

export async function createBuilding(payload: unknown) {
  const { data } = await apiClient.post<ApiResponse<{ id: string }>>('/buildings', payload)
  return data.data
}

export async function updateBuilding(id: string, payload: unknown) {
  const { data } = await apiClient.patch<ApiResponse<{ id: string }>>(`/buildings/${id}`, payload)
  return data.data
}

export async function updateBuildingStatus(id: string, status: 'ACTIVE' | 'INACTIVE') {
  const { data } = await apiClient.patch(`/buildings/${id}/status`, { status })
  return data.data
}

export async function deleteBuilding(id: string) {
  await apiClient.delete(`/buildings/${id}`)
}

export async function resolveMapUrl(url: string) {
  const { data } = await apiClient.get<ApiResponse<{ latitude: number | null; longitude: number | null }>>(`/buildings/resolve-map-url?url=${encodeURIComponent(url)}`)
  return data.data
}
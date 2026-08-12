import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Bell, Trash2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS, NOTICE_CATEGORIES } from '@/lib/utils/constants'
import { formatDateTime } from '@/lib/utils/format'
import { showToast } from '@/components/ui/toaster'
import type { Notice } from '@/types'

const noticeSchema = z.object({
  title:      z.string().min(5).max(255),
  body:       z.string().min(10).max(5000),
  category:   z.string(),
  targetType: z.enum(['ALL_BUILDINGS', 'BUILDING', 'FLOOR', 'ROOM', 'TENANT']),
})

export default function OwnerNoticesPage() {
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.notices.ownerList(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/owner/notices')
      return data.data
    },
  })

  const { mutate: createNotice, isPending } = useMutation({
    mutationFn: (v: unknown) => apiClient.post('/owner/notices', v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notices.ownerList() })
      showToast('Notice published', 'success')
      setShowForm(false)
      reset()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to create notice', 'error')
    },
  })

  const { mutate: deleteNotice } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/owner/notices/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notices.ownerList() })
      showToast('Notice removed', 'success')
    },
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(noticeSchema),
  })

  const notices: Notice[] = data?.items ?? []

  if (isLoading) return <PageLoader />

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notices"
        description="Send announcements to your tenants"
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            {showForm ? 'Cancel' : 'New notice'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardTitle className="mb-4">Create notice</CardTitle>
          <form onSubmit={handleSubmit((v) => createNotice(v))} className="space-y-4">
            <FormField label="Title" error={errors.title?.message} required>
              <Input {...register('title')} placeholder="Water supply maintenance this Saturday" />
            </FormField>

            <div className="grid grid-cols-2 gap-4">
              <FormField label="Category" error={errors.category?.message} required>
                <Select
                  {...register('category')}
                  placeholder="Select category"
                  options={NOTICE_CATEGORIES}
                />
              </FormField>
              <FormField label="Send to" error={errors.targetType?.message} required>
                <Select
                  {...register('targetType')}
                  placeholder="Select audience"
                  options={[
                    { value: 'ALL_BUILDINGS', label: 'All tenants' },
                    { value: 'BUILDING',      label: 'One building' },
                    { value: 'TENANT',        label: 'Specific tenant' },
                  ]}
                />
              </FormField>
            </div>

            <FormField label="Message" error={errors.body?.message} required>
              <Textarea {...register('body')} rows={4} placeholder="Write your notice here..." />
            </FormField>

            <Button type="submit" loading={isPending}>
              Publish notice
            </Button>
          </form>
        </Card>
      )}

      {!notices.length ? (
        <EmptyState
          icon={<Bell className="h-12 w-12" />}
          title="No notices sent"
          description="Create a notice to inform your tenants"
        />
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <Card key={n.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-gray-900">{n.title}</h3>
                    <Badge variant="info">{n.category}</Badge>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{n.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    <span>→ {n.targetType.replace('_', ' ').toLowerCase()}</span>
                    {n.targetBuilding && <span>{n.targetBuilding.name}</span>}
                    <span>{formatDateTime(n.publishAt)}</span>
                    {n.readCount !== undefined && (
                      <span>{n.readCount} reads</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteNotice(n.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded flex-shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
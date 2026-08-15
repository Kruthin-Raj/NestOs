import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Plus, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS, ISSUE_CATEGORIES } from '@/lib/utils/constants'
import { relativeTime } from '@/lib/utils/format'
import { showToast } from '@/components/ui/toaster'
import type { Issue } from '@/types'

const issueSchema = z.object({
  category:    z.string().min(1, 'Select a category'),
  priority:    z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']),
  title:       z.string().min(10, 'Describe the issue briefly (min 10 chars)'),
  description: z.string().min(20, 'Add more details (min 20 chars)'),
})

export default function TenantIssuesPage() {
  const [showForm, setShowForm] = useState(false)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.issues.my(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/issues/my')
      return data.data
    },
  })

  const { mutate: raiseIssue, isPending } = useMutation({
    mutationFn: (v: unknown) => apiClient.post('/issues', v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.issues.my() })
      showToast('Issue raised. Owner has been notified.', 'success')
      setShowForm(false)
      reset()
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Failed to raise issue', 'error')
    },
  })

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(issueSchema),
  })

  const issues: Issue[] = data?.items ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Issues"
        description="Report and track maintenance requests"
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="h-4 w-4 mr-1" />
            {showForm ? 'Cancel' : 'Raise issue'}
          </Button>
        }
      />

      {showForm && (
        <Card>
          <CardTitle className="mb-4">Raise a new issue</CardTitle>
          <form onSubmit={handleSubmit((v) => raiseIssue(v))} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField label="Category" error={errors.category?.message} required>
                <Select
                  {...register('category')}
                  placeholder="Select category"
                  options={ISSUE_CATEGORIES}
                />
              </FormField>
              <FormField label="Priority" error={errors.priority?.message} required>
                <Select
                  {...register('priority')}
                  placeholder="Select priority"
                  options={[
                    { value: 'LOW',    label: 'Low' },
                    { value: 'MEDIUM', label: 'Medium' },
                    { value: 'HIGH',   label: 'High' },
                    { value: 'URGENT', label: 'Urgent' },
                  ]}
                />
              </FormField>
            </div>
            <FormField label="Title" error={errors.title?.message} required>
              <Input {...register('title')} placeholder="AC not cooling in my room" />
            </FormField>
            <FormField label="Description" error={errors.description?.message} required>
              <Textarea
                {...register('description')}
                rows={3}
                placeholder="The AC unit in room 101 bed A has not been cooling for 3 days..."
              />
            </FormField>
            <Button type="submit" loading={isPending}>
              Submit issue
            </Button>
          </form>
        </Card>
      )}

      {isLoading ? null : !issues.length ? (
        <EmptyState
          icon={<AlertCircle className="h-12 w-12" />}
          title="No issues raised"
          description="Report maintenance or other problems here"
        />
      ) : (
        <div className="space-y-3">
          {issues.map((issue) => (
            <Link key={issue.id} to={`/tenant/issues/${issue.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{issue.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {issue.category} · {relativeTime(issue.createdAt)}
                    </p>
                    {issue.latestComment && (
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {issue.latestComment.authorRole}: {issue.latestComment.body}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                    <StatusBadge status={issue.priority} />
                    <StatusBadge status={issue.status} />
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
'use client'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { FormField } from '@/components/ui/form-field'
import { Card, CardTitle } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { formatDateTime } from '@/lib/utils/format'
import { showToast } from '@/components/ui/toaster'
import { QUERY_KEYS } from '@/lib/utils/constants'
import type { Issue, IssueComment } from '@/types'
import { cn } from '@/lib/utils/cn'

const statusSchema = z.object({
  status:          z.enum(['IN_PROGRESS', 'RESOLVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
})

const commentSchema = z.object({
  body: z.string().min(5, 'Comment must be at least 5 characters'),
})

export default function OwnerIssueDetailPage() {
  const issueId = useRequiredParam('issueId')
  const qc          = useQueryClient()

  const { data: issue, isLoading } = useQuery({
    queryKey: ['issue', 'owner', issueId],
    queryFn:  async () => {
      const { data } = await apiClient.get(`/issues/owner`)
      const found = data.data.items.find((i: Issue) => i.id === issueId)
      if (!found) {
        const { data: d } = await apiClient.get(`/issues/my/${issueId}`)
        return d.data as Issue
      }
      return found as Issue
    },
  })

  const { mutate: updateStatus, isPending: updatingStatus } = useMutation({
    mutationFn: (v: { status: string; rejectionReason?: string }) =>
      apiClient.patch(`/issues/owner/${issueId}/status`, v),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.issues.ownerList() })
      showToast('Issue status updated', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Update failed', 'error')
    },
  })

  const { mutate: addComment, isPending: commenting } = useMutation({
    mutationFn: (body: string) =>
      apiClient.post(`/issues/owner/${issueId}/comments`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['issue', 'owner', issueId] })
      commentForm.reset()
      showToast('Comment added', 'success')
    },
  })

  const statusForm = useForm({ resolver: zodResolver(statusSchema) })
  const commentForm = useForm({ resolver: zodResolver(commentSchema) })

  if (isLoading) return <PageLoader />
  if (!issue) return null

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{issue.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {issue.tenant?.fullName} · {issue.building?.name}
            {issue.room && ` · Room ${issue.room.roomNumber}`}
          </p>
        </div>
        <div className="flex gap-2">
          <StatusBadge status={issue.priority} />
          <StatusBadge status={issue.status} />
        </div>
      </div>

      <Card>
        <CardTitle className="mb-2">Description</CardTitle>
        <p className="text-sm text-gray-700">{issue.description}</p>
        <p className="text-xs text-gray-400 mt-2">{formatDateTime(issue.createdAt)}</p>
      </Card>

      {/* Status update */}
      {['OPEN', 'IN_PROGRESS', 'REOPENED'].includes(issue.status) && (
        <Card>
          <CardTitle className="mb-3">Update status</CardTitle>
          <form
            onSubmit={statusForm.handleSubmit((v) => updateStatus(v))}
            className="space-y-3"
          >
            <FormField label="New status">
              <Select
                {...statusForm.register('status')}
                placeholder="Select status"
                options={
                  issue.status === 'OPEN' || issue.status === 'REOPENED'
                    ? [
                        { value: 'IN_PROGRESS', label: 'Start working on it' },
                        { value: 'REJECTED',    label: 'Reject issue' },
                      ]
                    : [
                        { value: 'RESOLVED', label: 'Mark as resolved' },
                        { value: 'REJECTED', label: 'Reject issue' },
                      ]
                }
              />
            </FormField>
            {statusForm.watch('status') === 'REJECTED' && (
              <FormField label="Rejection reason" required>
                <Textarea
                  {...statusForm.register('rejectionReason')}
                  rows={2}
                  placeholder="Explain why this issue was rejected..."
                />
              </FormField>
            )}
            <Button type="submit" size="sm" loading={updatingStatus}>
              Update status
            </Button>
          </form>
        </Card>
      )}

      {/* Comments */}
      <Card>
        <CardTitle className="mb-4">Comments</CardTitle>
        {issue.comments?.map((c: IssueComment) => (
          <IssueCommentBubble key={c.id} comment={c} />
        ))}

        {/* Add comment */}
        <form
          onSubmit={commentForm.handleSubmit((v) => addComment(v.body))}
          className="mt-4 space-y-2"
        >
          <Textarea
            {...commentForm.register('body')}
            rows={2}
            placeholder="Add a note or update for the tenant..."
          />
          {commentForm.formState.errors.body && (
            <p className="text-xs text-red-500">{commentForm.formState.errors.body.message}</p>
          )}
          <Button type="submit" size="sm" loading={commenting}>
            Post comment
          </Button>
        </form>
      </Card>
    </div>
  )
}

function IssueCommentBubble({ comment }: { comment: IssueComment }) {
  const isOwner = comment.authorRole === 'OWNER'
  return (
    <div className={cn('flex mb-3', isOwner ? 'justify-end' : 'justify-start')}>
      <div className={cn(
        'max-w-xs rounded-xl px-3 py-2',
        isOwner ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-800'
      )}>
        <p className="text-xs font-medium mb-0.5 opacity-70">
          {isOwner ? 'You (Owner)' : 'Tenant'}
        </p>
        <p className="text-sm">{comment.body}</p>
        <p className={cn('text-xs mt-1 opacity-60', isOwner ? 'text-right' : '')}>
          {formatDateTime(comment.createdAt)}
        </p>
      </div>
    </div>
  )
}
'use client'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
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

export default function TenantIssueDetailPage() {
  const issueId = useRequiredParam('issueId')
  const qc          = useQueryClient()

  const { data: issue, isLoading } = useQuery({
    queryKey: QUERY_KEYS.issues.myDetail(issueId),
    queryFn:  async () => {
      const { data } = await apiClient.get(`/issues/my/${issueId}`)
      return data.data as Issue
    },
  })

  const { mutate: addComment, isPending: commenting } = useMutation({
    mutationFn: (body: string) =>
      apiClient.post(`/issues/my/${issueId}/comments`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.issues.myDetail(issueId) })
      commentForm.reset()
    },
  })

  const { mutate: reopenIssue, isPending: reopening } = useMutation({
    mutationFn: (reason: string) =>
      apiClient.post(`/issues/my/${issueId}/reopen`, { reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.issues.myDetail(issueId) })
      showToast('Issue reopened', 'success')
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
      showToast(msg ?? 'Cannot reopen issue', 'error')
    },
  })

  const commentForm = useForm({
    resolver: zodResolver(z.object({ body: z.string().min(5) })),
  })

  const reopenForm = useForm({
    resolver: zodResolver(z.object({ reason: z.string().min(10) })),
  })

  if (isLoading) return <PageLoader />
  if (!issue) return null

  return (
    <div className="max-w-xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">{issue.title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{issue.category}</p>
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

      {/* Comments */}
      <Card>
        <CardTitle className="mb-4">Updates</CardTitle>
        {issue.comments?.length === 0 && (
          <p className="text-sm text-gray-400 mb-3">No updates yet from the owner.</p>
        )}
        {issue.comments?.map((c: IssueComment) => (
          <div key={c.id} className={cn('flex mb-3', c.authorRole === 'TENANT' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-xs rounded-xl px-3 py-2',
              c.authorRole === 'TENANT'
                ? 'bg-teal-600 text-white'
                : 'bg-gray-100 text-gray-800'
            )}>
              <p className="text-xs font-medium mb-0.5 opacity-70">
                {c.authorRole === 'TENANT' ? 'You' : 'Owner'}
              </p>
              <p className="text-sm">{c.body}</p>
              <p className={cn('text-xs mt-1 opacity-60', c.authorRole === 'TENANT' ? 'text-right' : '')}>
                {formatDateTime(c.createdAt)}
              </p>
            </div>
          </div>
        ))}

        {/* Add comment (only if issue is open/in-progress/reopened) */}
        {['OPEN', 'IN_PROGRESS', 'REOPENED', 'RESOLVED'].includes(issue.status) && (
          <form
            onSubmit={commentForm.handleSubmit((v) => addComment(v.body))}
            className="mt-4 space-y-2"
          >
            <Textarea
              {...commentForm.register('body')}
              rows={2}
              placeholder="Add a comment..."
            />
            <Button type="submit" size="sm" loading={commenting}>
              Send
            </Button>
          </form>
        )}
      </Card>

      {/* Reopen */}
      {issue.canReopen && issue.status === 'RESOLVED' && (
        <Card>
          <CardTitle className="mb-3">Not resolved?</CardTitle>
          <p className="text-sm text-gray-500 mb-3">
            You can reopen this issue if the problem wasn't fixed.
          </p>
          <form
            onSubmit={reopenForm.handleSubmit((v) => reopenIssue(v.reason))}
            className="space-y-2"
          >
            <Textarea
              {...reopenForm.register('reason')}
              rows={2}
              placeholder="Explain why the issue is not resolved..."
            />
            <Button type="submit" variant="outline" size="sm" loading={reopening}>
              Reopen issue
            </Button>
          </form>
        </Card>
      )}
    </div>
  )
}
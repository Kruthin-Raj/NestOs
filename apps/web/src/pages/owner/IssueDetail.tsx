import { useState, useEffect } from 'react'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { Download, Eye, Loader2 } from 'lucide-react'
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
  status: z.enum(['IN_PROGRESS', 'RESOLVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
})

const commentSchema = z.object({
  body: z.string().min(5, 'Comment must be at least 5 characters'),
})

export default function OwnerIssueDetailPage() {
  const issueId = useRequiredParam('issueId')
  const qc = useQueryClient()

  const { data: issue, isLoading } = useQuery({
    queryKey: ['issue', 'owner', issueId],
    queryFn: async () => {
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
    <>
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

          {issue.photoUrls && issue.photoUrls.length > 0 && (
            <div className="mt-4 space-y-2">
              <p className="text-sm font-medium text-gray-700">Attachments</p>
              <div className="flex flex-wrap gap-4">
                {issue.photoUrls.map((url, i) => (
                  <IssueAttachment key={i} url={url} index={i} />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1 mt-4">
            <p className="text-xs text-gray-400">Created: {formatDateTime(issue.createdAt)}</p>
            {issue.status === 'RESOLVED' && issue.resolvedAt && (
              <p className="text-xs text-green-600 font-medium">Cleared: {formatDateTime(issue.resolvedAt)}</p>
            )}
          </div>
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
                        { value: 'RESOLVED', label: 'Issue cleared' },
                        { value: 'REJECTED', label: 'Reject issue' },
                      ]
                      : [
                        { value: 'RESOLVED', label: 'Issue cleared' },
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
    </>
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

function IssueAttachment({ url, index }: { url: string; index: number }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      try {
        const fetchUrl = url.replace('/api/v1', '')
        const res = await apiClient.get(fetchUrl, { responseType: 'blob' })
        if (!active) return
        const blob = res.data as Blob
        setBlobUrl(URL.createObjectURL(blob))
      } catch (e) {
        console.error('Failed to load attachment', e)
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [url])

  function handleDownload() {
    if (!blobUrl) return
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `attachment-${index + 1}`
    a.click()
  }

  if (loading) {
    return (
      <div className="h-24 w-24 flex items-center justify-center border rounded-md bg-gray-50">
        <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!blobUrl) {
    return (
      <div className="h-24 w-24 flex items-center justify-center border rounded-md bg-gray-50 text-xs text-red-500 text-center p-2">
        Failed to load
      </div>
    )
  }

  return (
    <>
      <div className="group relative border rounded-md overflow-hidden h-24 w-24 cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
        <img src={blobUrl} alt={`Attachment ${index + 1}`} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setIsLightboxOpen(true) }}
            className="text-white hover:text-indigo-200"
            title="View"
          >
            <Eye className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleDownload() }}
            className="text-white hover:text-indigo-200"
            title="Download"
          >
            <Download className="h-5 w-5" />
          </button>
        </div>
      </div>

      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 sm:p-8"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div className="relative max-w-5xl max-h-full w-full h-full flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
            <div className="absolute top-0 right-0 flex gap-4 p-4 z-50 bg-black/50 rounded-bl-lg">
              <button
                onClick={handleDownload}
                className="text-white hover:text-indigo-300 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-md backdrop-blur-sm"
              >
                <Download className="h-5 w-5" /> Download
              </button>
              <button
                onClick={() => setIsLightboxOpen(false)}
                className="text-white hover:text-red-400 flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-md backdrop-blur-sm"
              >
                Close
              </button>
            </div>
            <img src={blobUrl} alt={`Attachment ${index + 1}`} className="max-w-full max-h-full object-contain rounded-md shadow-2xl" />
          </div>
        </div>
      )}
    </>
  )
}
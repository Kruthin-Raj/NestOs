import { useState, useEffect } from 'react'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { Download, Eye, Loader2 } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
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
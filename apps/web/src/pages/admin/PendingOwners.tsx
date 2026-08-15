import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/shared/page-header'
import { DocumentRow, type ReviewDocument } from '@/components/shared/document-row'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { formatDateTime } from '@/lib/utils/format'

const PENDING_OWNERS_KEY = ['admin', 'owners', 'pending'] as const

type PendingOwner = {
  id: string
  fullName: string
  businessName: string | null
  phone: string | null
  city: string | null
  panNumber: string | null
  aadhaarNumber: string | null
  createdAt: string
  user: { email: string; createdAt: string }
  documents: ReviewDocument[]
}

export default function AdminPendingOwnersPage() {
  const { data, isLoading } = useQuery({
    queryKey: PENDING_OWNERS_KEY,
    queryFn:  async () => {
      const { data } = await apiClient.get('/admin/owners/pending')
      return data.data
    },
  })

  if (isLoading) return <PageLoader />

  const owners: PendingOwner[] = data?.owners ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner verification"
        description="Owners waiting for review. Approving one unlocks their dashboard."
      />

      {!owners.length ? (
        <EmptyState
          icon={<ShieldCheck className="h-12 w-12" />}
          title="Nothing to review"
          description="No owners are currently under review."
        />
      ) : (
        owners.map((owner) => <OwnerReviewCard key={owner.id} owner={owner} />)
      )}
    </div>
  )
}

function OwnerReviewCard({ owner }: { owner: PendingOwner }) {
  const qc = useQueryClient()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const onSettled = (message: string) => () => {
    qc.invalidateQueries({ queryKey: PENDING_OWNERS_KEY })
    showToast(message, 'success')
  }

  const onError = (fallback: string) => (err: unknown) => {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    showToast(msg ?? fallback, 'error')
  }

  const { mutate: approve, isPending: approving } = useMutation({
    mutationFn: () => apiClient.post(`/admin/owners/${owner.id}/approve`, { notes: notes || undefined }),
    onSuccess:  onSettled('Owner approved'),
    onError:    onError('Could not approve owner'),
  })

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: () => apiClient.post(`/admin/owners/${owner.id}/reject`, { reason }),
    onSuccess:  onSettled('Owner rejected'),
    onError:    onError('Could not reject owner'),
  })

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>{owner.fullName || '(name not set)'}</CardTitle>
          <p className="text-sm text-gray-500">{owner.user.email}</p>
          {owner.businessName && (
            <p className="text-sm text-gray-500">{owner.businessName}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Submitted {formatDateTime(owner.createdAt)}
            {owner.city ? ` · ${owner.city}` : ''}
          </p>
        </div>
        <Badge variant="warning">Under review</Badge>
      </div>

      {/* Identity numbers are shown because verifying them is the point of this
          screen. They are not logged anywhere. */}
      {(owner.panNumber || owner.aadhaarNumber) && (
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-600">
          {owner.panNumber && <span>PAN: <span className="font-mono">{owner.panNumber}</span></span>}
          {owner.aadhaarNumber && <span>Aadhaar: <span className="font-mono">{owner.aadhaarNumber}</span></span>}
        </div>
      )}

      <div className="mt-4">
        <p className="text-xs font-medium text-gray-500 mb-2">
          Documents ({owner.documents.length})
        </p>
        {!owner.documents.length ? (
          <p className="text-sm text-gray-400">No documents uploaded.</p>
        ) : (
          <div className="space-y-1.5">
            {owner.documents.map((doc) => (
              <DocumentRow key={doc.id} doc={doc} />
            ))}
          </div>
        )}
      </div>

      <div className="mt-5 border-t pt-4 space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Approval notes (optional)"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={approving} onClick={() => approve()}>
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowReject((v) => !v)}
          >
            {showReject ? 'Cancel' : 'Reject'}
          </Button>
        </div>

        {showReject && (
          <div className="space-y-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason for rejection (at least 10 characters) — the owner sees this"
            />
            <Button
              size="sm"
              variant="outline"
              loading={rejecting}
              disabled={reason.trim().length < 10}
              onClick={() => reject()}
            >
              Confirm rejection
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}

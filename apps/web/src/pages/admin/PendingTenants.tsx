import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { BadgeCheck } from 'lucide-react'
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

const PENDING_TENANTS_KEY = ['admin', 'tenants', 'pending'] as const

type PendingTenant = {
  id: string
  fullName: string
  phone: string | null
  city: string | null
  profession: string | null
  createdAt: string
  user: { email: string }
  documents: ReviewDocument[]
}

export default function AdminPendingTenantsPage() {
  const { data, isLoading } = useQuery({
    queryKey: PENDING_TENANTS_KEY,
    queryFn:  async () => {
      const { data } = await apiClient.get('/admin/tenants/pending')
      return data.data
    },
  })

  if (isLoading) return <PageLoader />

  const tenants: PendingTenant[] = data?.tenants ?? []

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tenant identity verification"
        description="Until a tenant is verified they cannot book a bed, and owners cannot assign them one."
      />

      {!tenants.length ? (
        <EmptyState
          icon={<BadgeCheck className="h-12 w-12" />}
          title="Nothing to review"
          description="No tenants have uploaded an identity document awaiting review."
        />
      ) : (
        tenants.map((tenant) => <TenantReviewCard key={tenant.id} tenant={tenant} />)
      )}
    </div>
  )
}

function TenantReviewCard({ tenant }: { tenant: PendingTenant }) {
  const qc = useQueryClient()
  const [showReject, setShowReject] = useState(false)
  const [reason, setReason] = useState('')
  const [notes, setNotes] = useState('')

  const onDone = (message: string) => () => {
    qc.invalidateQueries({ queryKey: PENDING_TENANTS_KEY })
    showToast(message, 'success')
  }

  const onError = (fallback: string) => (err: unknown) => {
    const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
    showToast(msg ?? fallback, 'error')
  }

  const { mutate: verify, isPending: verifying } = useMutation({
    mutationFn: () =>
      apiClient.post(`/admin/tenants/${tenant.id}/verify-id`, { notes: notes || undefined }),
    onSuccess:  onDone('Tenant verified — they can book now'),
    onError:    onError('Could not verify tenant'),
  })

  const { mutate: reject, isPending: rejecting } = useMutation({
    mutationFn: () => apiClient.post(`/admin/tenants/${tenant.id}/reject-id`, { reason }),
    onSuccess:  onDone('Document rejected'),
    onError:    onError('Could not reject document'),
  })

  return (
    <Card>
      <div className="flex items-start justify-between gap-4">
        <div>
          <CardTitle>{tenant.fullName || '(name not set)'}</CardTitle>
          <p className="text-sm text-gray-500">{tenant.user.email}</p>
          <p className="text-xs text-gray-400 mt-1">
            Joined {formatDateTime(tenant.createdAt)}
            {tenant.city ? ` · ${tenant.city}` : ''}
            {tenant.phone ? ` · ${tenant.phone}` : ''}
          </p>
        </div>
        <Badge variant="warning">Awaiting review</Badge>
      </div>

      <div className="mt-4">
        <p className="text-xs font-medium text-gray-500 mb-2">
          Documents ({tenant.documents.length})
        </p>
        <div className="space-y-1.5">
          {tenant.documents.map((doc) => (
            <DocumentRow key={doc.id} doc={doc} />
          ))}
        </div>
      </div>

      <div className="mt-5 border-t pt-4 space-y-3">
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Verification notes (optional)"
        />
        <div className="flex flex-wrap gap-2">
          <Button size="sm" loading={verifying} onClick={() => verify()}>
            Verify identity
          </Button>
          <Button size="sm" variant="outline" onClick={() => setShowReject((v) => !v)}>
            {showReject ? 'Cancel' : 'Reject'}
          </Button>
        </div>

        {showReject && (
          <div className="space-y-2">
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Reason for rejection (at least 10 characters) — the tenant sees this"
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

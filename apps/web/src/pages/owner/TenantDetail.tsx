import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BadgeCheck, Phone, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { useRequiredParam } from '@/lib/utils/use-required-param'
import { formatRupees, formatDate, formatDateTime, formatBillingPeriod } from '@/lib/utils/format'

type TenantDetail = {
  id: string
  fullName: string
  gender: string | null
  profession: string | null
  phone: string | null
  email: string | null
  dateOfBirth: string | null
  employerOrCollege: string | null
  emergencyName: string | null
  emergencyPhone: string | null
  emergencyRelation: string | null
  isIdVerified: boolean
  status: string
  city: string | null
  booking: {
    id: string
    moveInDate: string
    monthlyRent: number
    depositAmount: number
    building: { id: string; name: string; addressLine1: string; city: string } | null
    room: { id: string; roomNumber: string; type: string } | null
    bed: { id: string; bedLabel: string; monthlyRent: number } | null
  }
  recentPayments: Array<{
    id: string; type: string; status: string; amountRupees: number
    billingMonth: number | null; billingYear: number | null
    receiptNumber: string | null; createdAt: string
  }>
  recentIssues: Array<{
    id: string; title: string; category: string
    priority: string; status: string; createdAt: string
  }>
}

export default function OwnerTenantDetailPage() {
  const tenantId = useRequiredParam('tenantId')

  const { data, isLoading } = useQuery({
    queryKey: ['owner', 'tenants', tenantId],
    queryFn:  async () => {
      const { data } = await apiClient.get(`/owner/tenants/${tenantId}`)
      return data.data as TenantDetail
    },
  })

  if (isLoading) return <PageLoader />
  if (!data) return <EmptyState title="Tenant not found" />

  const b = data.booking

  return (
    <div className="space-y-6">
      <PageHeader
        title={data.fullName || '(name not set)'}
        description={[b.building?.name, b.room && `Room ${b.room.roomNumber}`, b.bed && `Bed ${b.bed.bedLabel}`]
          .filter(Boolean)
          .join(' · ')}
        actions={
          <Link to="/owner/tenants">
            <Button variant="outline" size="sm">Back to tenants</Button>
          </Link>
        }
      />

      {/* Who they are */}
      <Card>
        <div className="flex items-start justify-between gap-4">
          <CardTitle>Tenant</CardTitle>
          <div className="flex gap-2">
            {data.isIdVerified && (
              <Badge variant="success">
                <BadgeCheck className="h-3 w-3 mr-1 inline" /> ID verified
              </Badge>
            )}
            <StatusBadge status={data.status as never} />
          </div>
        </div>

        <div className="mt-3 grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          {data.email && (
            <p className="flex items-center gap-2 text-gray-600">
              <Mail className="h-4 w-4 text-gray-400" /> {data.email}
            </p>
          )}
          {data.phone && (
            <p className="flex items-center gap-2 text-gray-600">
              <Phone className="h-4 w-4 text-gray-400" /> {data.phone}
            </p>
          )}
          {data.profession && (
            <p className="text-gray-600">
              {data.profession.replace(/_/g, ' ').toLowerCase()}
              {data.employerOrCollege ? ` · ${data.employerOrCollege}` : ''}
            </p>
          )}
          {data.dateOfBirth && (
            <p className="text-gray-600">Born {formatDate(data.dateOfBirth)}</p>
          )}
        </div>

        {data.emergencyName && (
          <div className="mt-4 border-t pt-3">
            <p className="text-xs font-medium text-gray-500 mb-1">Emergency contact</p>
            <p className="text-sm text-gray-700">
              {data.emergencyName}
              {data.emergencyRelation ? ` (${data.emergencyRelation})` : ''}
              {data.emergencyPhone ? ` · ${data.emergencyPhone}` : ''}
            </p>
          </div>
        )}
      </Card>

      {/* Tenancy */}
      <Card>
        <CardTitle className="mb-3">Tenancy</CardTitle>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Monthly rent', value: formatRupees(b.monthlyRent) },
            { label: 'Deposit',      value: formatRupees(b.depositAmount) },
            { label: 'Moved in',     value: formatDate(b.moveInDate) },
            { label: 'Room / bed',   value: `${b.room?.roomNumber ?? '—'} / ${b.bed?.bedLabel ?? '—'}` },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-xs text-gray-500">{s.label}</p>
              <p className="text-sm font-semibold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Payments */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100">
          <CardTitle>Recent payments</CardTitle>
        </div>
        {!data.recentPayments.length ? (
          <p className="p-4 text-sm text-gray-400">No payments yet.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentPayments.map((p) => (
              <div key={p.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {p.billingMonth
                      ? `Rent — ${formatBillingPeriod(p.billingMonth, p.billingYear!)}`
                      : p.type.replace(/_/g, ' ')}
                  </p>
                  {p.receiptNumber && (
                    <p className="text-xs text-gray-400">{p.receiptNumber}</p>
                  )}
                  <p className="text-xs text-gray-400">{formatDateTime(p.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-gray-900">{formatRupees(p.amountRupees)}</p>
                  <StatusBadge status={p.status as never} />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Issues */}
      <Card padding={false}>
        <div className="px-4 py-3 border-b border-gray-100">
          <CardTitle>Recent issues</CardTitle>
        </div>
        {!data.recentIssues.length ? (
          <p className="p-4 text-sm text-gray-400">Nothing reported.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {data.recentIssues.map((i) => (
              <Link
                key={i.id}
                to={`/owner/issues/${i.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{i.title}</p>
                  <p className="text-xs text-gray-500">
                    {i.category.replace(/_/g, ' ')} · {formatDateTime(i.createdAt)}
                  </p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <StatusBadge status={i.priority as never} />
                  <StatusBadge status={i.status as never} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}

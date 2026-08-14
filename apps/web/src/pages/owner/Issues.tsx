import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { TableSkeleton } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { relativeTime } from '@/lib/utils/format'
import type { Issue } from '@/types'

export default function OwnerIssuesPage() {
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.issues.ownerList({ status: statusFilter }),
    queryFn:  async () => {
      const params = statusFilter ? `?status=${statusFilter}` : ''
      const { data } = await apiClient.get(`/issues/owner${params}`)
      return data.data
    },
  })

  const issues:  Issue[] = data?.items ?? []
  const summary          = data?.summary

  return (
    <div className="space-y-6">
      <PageHeader title="Issues" description="Maintenance and support requests" />

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Open',       value: summary.open,       color: 'text-amber-600' },
            { label: 'In progress',value: summary.inProgress, color: 'text-blue-600' },
            { label: 'Urgent',     value: summary.urgent,     color: 'text-red-600' },
            { label: 'Resolved',   value: summary.resolved,   color: 'text-green-600' },
          ].map((s) => (
            <Card key={s.label} className="py-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="w-48">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '',            label: 'All statuses' },
            { value: 'OPEN',        label: 'Open' },
            { value: 'IN_PROGRESS', label: 'In progress' },
            { value: 'REOPENED',    label: 'Reopened' },
            { value: 'RESOLVED',    label: 'Resolved' },
            { value: 'REJECTED',    label: 'Rejected' },
          ]}
        />
      </div>

      {isLoading ? (
        <Card><TableSkeleton /></Card>
      ) : !issues.length ? (
        <EmptyState
          icon={<AlertCircle className="h-12 w-12" />}
          title="No issues"
          description="All quiet — no reported issues"
        />
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-100">
            {issues.map((issue) => (
              <Link
                key={issue.id}
                to={`/owner/issues/${issue.id}`}
                className="flex items-start gap-3 p-4 hover:bg-gray-50"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    {issue.tenant?.fullName} · {issue.building?.name}
                    {issue.room && ` · Room ${issue.room.roomNumber}`}
                  </p>
                  {issue.latestComment && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate">
                      Latest: {issue.latestComment.body}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <StatusBadge status={issue.priority} />
                  <StatusBadge status={issue.status} />
                  <p className="text-xs text-gray-400">{relativeTime(issue.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertCircle } from 'lucide-react'
import { Select } from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { TableSkeleton } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { relativeTime } from '@/lib/utils/format'
import type { Issue } from '@/types'

export default function AdminIssuesPage() {
  const [statusFilter, setStatusFilter] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'issues'],
    queryFn:  async () => {
      const { data } = await apiClient.get('/admin/issues')
      return data.data
    },
  })

  // We filter on the frontend since the admin endpoint returns all issues
  let issues: Issue[] = data?.items ?? []
  if (statusFilter) {
    issues = issues.filter(i => i.status === statusFilter)
  }
  
  const summary = data?.summary

  return (
    <div className="space-y-6">
      <PageHeader title="All Platform Issues" description="Monitor issues across all buildings" />

      {/* Summary */}
      {summary && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Open',            value: summary.open,       color: 'text-amber-600' },
            { label: 'In progress',     value: summary.inProgress, color: 'text-blue-600' },
            { label: 'Under Verification', value: summary.verifying,  color: 'text-purple-600' },
            { label: 'Resolved',        value: summary.resolved,   color: 'text-green-600' },
          ].map((s) => (
            <Card key={s.label} className="py-3 text-center">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="w-56">
        <Select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '',            label: 'All statuses' },
            { value: 'OPEN',        label: 'Open' },
            { value: 'IN_PROGRESS', label: 'In progress' },
            { value: 'PENDING_TENANT_VERIFICATION', label: 'Under Verification' },
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
          title="No issues found"
          description={statusFilter ? `No issues match the status "${statusFilter}"` : "All quiet — no reported issues"}
        />
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-100">
            {issues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-start gap-3 p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{issue.title}</p>
                  </div>
                  <p className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Building:</span> {issue.building?.name}
                    {issue.room && ` · Room ${issue.room.roomNumber}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    <span className="font-medium text-gray-700">Tenant:</span> {issue.tenant?.fullName} 
                    <span className="mx-2">|</span>
                    <span className="font-medium text-gray-700">Owner:</span> {issue.owner?.fullName || issue.owner?.user?.email}
                  </p>
                  {issue.latestComment && (
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      Latest: {issue.latestComment.body}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                  <StatusBadge status={issue.priority} />
                  <StatusBadge status={issue.status} />
                  <p className="text-xs text-gray-400">{relativeTime(issue.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

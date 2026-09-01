import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Flag, CheckCircle, XCircle, Search, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { apiErrorMessage } from '@/lib/utils/api-error'
import { formatDateTime } from '@/lib/utils/format'

const REPORTS_QUERY_KEY = ['admin', 'reports'] as const

interface Report {
  id: string
  reporterId: string
  reportedUserId: string
  reason: string
  status: 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED'
  adminNotes: string | null
  createdAt: string
  reporter: { id: string; email: string; role: string }
  reportedUser: { id: string; email: string; role: string; rejectionCount: number; isEmailVerified: boolean }
  escalation: { id: string, isResolved: boolean } | null
}

export default function AdminReportsPage() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<Report['status']>('PENDING')
  const [adminNotes, setAdminNotes] = useState('')
  const [isEscalateModalOpen, setIsEscalateModalOpen] = useState(false)
  const [escalateMessage, setEscalateMessage] = useState('')

  const { data: reports, isLoading } = useQuery<Report[]>({
    queryKey: REPORTS_QUERY_KEY,
    queryFn: async () => {
      const res = await apiClient.get('/reports/admin')
      return res.data.data
    },
  })

  const { mutate: updateReport, isPending } = useMutation({
    mutationFn: async () => {
      if (!selectedReport) return
      await apiClient.patch(`/reports/admin/${selectedReport.id}`, {
        status: newStatus,
        adminNotes: adminNotes.trim() || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REPORTS_QUERY_KEY })
      showToast('Report updated successfully', 'success')
      setIsModalOpen(false)
    },
    onError: (err: unknown) => {
      showToast(apiErrorMessage(err, 'Failed to update report'), 'error')
    },
  })

  const { mutate: escalateToOwner, isPending: isEscalating } = useMutation({
    mutationFn: async () => {
      if (!selectedReport) return
      await apiClient.post(`/reports/admin/${selectedReport.id}/escalate`, {
        message: escalateMessage,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REPORTS_QUERY_KEY })
      showToast('Report escalated to owner successfully', 'success')
      setIsEscalateModalOpen(false)
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : 'Failed to escalate report', 'error')
    },
  })

  const { mutate: sendVerification, isPending: isSendingVerification } = useMutation({
    mutationFn: async (escalatedId: string) => {
      await apiClient.post(`/reports/admin/escalated/${escalatedId}/send-verification`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: REPORTS_QUERY_KEY })
      showToast('Verification sent to tenant', 'success')
    },
    onError: (err: unknown) => {
      showToast(err instanceof Error ? err.message : 'Failed to send verification', 'error')
    },
  })

  const openUpdateModal = (report: Report) => {
    setSelectedReport(report)
    setNewStatus(report.status)
    setAdminNotes(report.adminNotes || '')
    setIsModalOpen(true)
  }

  if (isLoading) return <PageLoader />

  const filteredReports = reports?.filter((r) => 
    r.reporter.email.toLowerCase().includes(search.toLowerCase()) ||
    r.reportedUser.email.toLowerCase().includes(search.toLowerCase()) ||
    r.reason.toLowerCase().includes(search.toLowerCase())
  ) || []

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Reports"
        description="Review and manage reports submitted by users."
      />

      <div className="flex gap-4 mb-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search reason or email..."
            className="pl-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-600">
            <thead className="bg-gray-50 text-xs font-semibold text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-4">Reporter</th>
                <th className="px-6 py-4">Reported User</th>
                <th className="px-6 py-4">Reason</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredReports.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-4">
                    <Link to={`/admin/users/${r.reporter.id}`} className="font-medium text-indigo-600 hover:underline">
                      {r.reporter.email}
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/admin/users/${r.reportedUser.id}`} className="font-medium text-indigo-600 hover:underline">
                      {r.reportedUser.email}
                    </Link>
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate" title={r.reason}>
                    {r.reason}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant={
                      r.status === 'PENDING' ? 'warning' :
                      r.status === 'RESOLVED' ? 'success' :
                      r.status === 'DISMISSED' ? 'default' : 'info'
                    }>
                      {r.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                    {r.reportedUser.role === 'OWNER' && !r.escalation && (
                      <Button variant="outline" size="sm" onClick={() => {
                        setSelectedReport(r)
                        setEscalateMessage('')
                        setIsEscalateModalOpen(true)
                      }}>
                        Escalate
                      </Button>
                    )}
                    {r.escalation && (
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={r.escalation.isResolved ? 'success' : 'warning'}>
                          {r.escalation.tenantVerified ? 'Verified Resolved' : r.escalation.isResolved ? 'Owner Resolved' : 'Escalated'}
                        </Badge>
                        {r.escalation.isResolved && !r.escalation.tenantVerified && (
                          <Button 
                            variant="secondary" 
                            size="sm" 
                            onClick={() => sendVerification(r.escalation!.id)}
                            disabled={isSendingVerification}
                            className="h-7 text-xs"
                          >
                            Send Verification
                          </Button>
                        )}
                      </div>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => openUpdateModal(r)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Manage
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredReports.length === 0 && (
            <EmptyState title="No reports found" description="No reports match your filters." />
          )}
        </div>
      </Card>

      {/* Update Modal */}
      {isModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Manage Report</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as Report['status'])}
                  className="w-full h-10 px-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="PENDING">Pending</option>
                  <option value="REVIEWED">Reviewed</option>
                  <option value="RESOLVED">Resolved</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Admin Notes</label>
                <textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Optional notes for admins..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => updateReport()}
                  disabled={isPending}
                >
                  {isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Escalate Modal */}
      {isEscalateModalOpen && selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Escalate to Owner</h3>
            <p className="text-sm text-gray-500 mb-4">
              Send this report directly to the property owner to resolve. It will appear on their dashboard.
            </p>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message for Owner</label>
                <textarea
                  value={escalateMessage}
                  onChange={(e) => setEscalateMessage(e.target.value)}
                  placeholder="Explain what the owner needs to do..."
                  className="w-full h-24 p-3 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setIsEscalateModalOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => escalateToOwner()}
                  disabled={isEscalating || !escalateMessage.trim()}
                >
                  {isEscalating ? 'Escalating...' : 'Escalate Report'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

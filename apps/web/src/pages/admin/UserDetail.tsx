import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  AlertTriangle,
  XCircle,
  Trash2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { PageLoader } from '@/components/feedback/loading-state'
import { EmptyState } from '@/components/feedback/empty-state'
import { DocumentRow } from '@/components/shared/document-row'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { apiErrorMessage } from '@/lib/utils/api-error'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { User, UserRole, UserStatus } from '@/types'

const USER_DETAIL_KEY = ['admin', 'user-detail'] as const

interface UserDetailResponse {
  user: User & {
    isFlagged: boolean
    rejectionCount: number
    statusReason?: string | null
    statusUpdatedAt?: string | null
    statusUpdatedBy?: string | null
  }
  ownerProfile?: {
    id: string
    fullName: string
    businessName: string | null
    panNumber: string | null
    aadhaarNumber: string | null
    verificationStatus: string
    verificationNotes: string | null
    verifiedAt: string | null
    documents: Array<{
      id: string
      documentType: string
      fileName: string
      fileUrl: string
      status: string
      reviewNotes: string | null
      createdAt: string
    }>
    _count?: { buildings: number }
  } | null
  tenantProfile?: {
    id: string
    fullName: string
    profession: string | null
    gender: string | null
    status: string
    isIdVerified: boolean
    profileCompletion: number
    emergencyName: string | null
    emergencyPhone: string | null
    documents: Array<{
      id: string
      documentType: string
      fileName: string
      fileUrl: string
      status: string
      reviewNotes: string | null
      createdAt: string
    }>
    preferences?: {
      smoking: string | null
      foodPreference: string | null
      compatibilityBio: string | null
    } | null
    currentBed?: {
      bedLabel: string
      room: {
        roomNumber: string
        building: { name: string; city: string }
      }
    } | null
    _count?: { bookings: number; payments: number; issues: number }
  } | null
  rejections: Array<{
    id: string
    targetType: string
    reason: string
    adminId: string | null
    createdAt: string
  }>
  recentAuditLogs: Array<{
    id: string
    action: string
    metadata: Record<string, unknown>
    createdAt: string
  }>
}

export default function AdminUserDetailPage() {
  const { userId } = useParams<{ userId: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()

  // Tabs
  const [activeTab, setActiveTab] = useState<'overview' | 'rejections' | 'audit' | 'documents'>('overview')

  // Status & Role Modals
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [newStatus, setNewStatus] = useState<UserStatus>('ACTIVE')
  const [statusReason, setStatusReason] = useState('')

  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [newRole, setNewRole] = useState<UserRole>('TENANT')
  const [roleReason, setRoleReason] = useState('')
  const [forceRoleChange, setForceRoleChange] = useState(false)

  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  const { data, isLoading } = useQuery<UserDetailResponse>({
    queryKey: [...USER_DETAIL_KEY, userId],
    queryFn: async () => {
      const res = await apiClient.get(`/admin/users/${userId}`)
      return res.data.data
    },
    enabled: !!userId,
  })

  const { mutate: updateStatus, isPending: updatingStatus } = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/admin/users/${userId}/status`, {
        status: newStatus,
        reason: statusReason.trim() || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_DETAIL_KEY })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      showToast('User status updated', 'success')
      setStatusModalOpen(false)
    },
    onError: (err: unknown) => {
      showToast(apiErrorMessage(err, 'Status update failed'), 'error')
    },
  })

  const { mutate: updateRole, isPending: updatingRole } = useMutation({
    mutationFn: async () => {
      await apiClient.patch(`/admin/users/${userId}/role`, {
        role: newRole,
        force: forceRoleChange,
        reason: roleReason.trim() || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_DETAIL_KEY })
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      showToast('User role updated', 'success')
      setRoleModalOpen(false)
    },
    onError: (err: unknown) => {
      showToast(apiErrorMessage(err, 'Role update failed'), 'error')
    },
  })

  const { mutate: deleteUser, isPending: deletingUser } = useMutation({
    mutationFn: async () => {
      await apiClient.delete(`/admin/users/${userId}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'users'] })
      showToast('User deleted', 'success')
      navigate('/admin/users')
    },
    onError: (err: unknown) => {
      showToast(apiErrorMessage(err, 'Deletion failed'), 'error')
    },
  })

  if (isLoading) return <PageLoader />
  if (!data || !data.user) {
    return (
      <EmptyState
        title="User not found"
        description="The requested user account does not exist or has been removed."
      />
    )
  }

  const { user, ownerProfile, tenantProfile, rejections, recentAuditLogs } = data
  const displayName = ownerProfile?.fullName || tenantProfile?.fullName || user.email.split('@')[0]
  const allDocs = ownerProfile?.documents || tenantProfile?.documents || []

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <Link
          to="/admin/users"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-gray-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Users
        </Link>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNewStatus(user.status)
              setStatusReason(user.statusReason || '')
              setStatusModalOpen(true)
            }}
          >
            Update Status
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setNewRole(user.role)
              setRoleReason('')
              setForceRoleChange(false)
              setRoleModalOpen(true)
            }}
          >
            Change Role
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            onClick={() => setDeleteModalOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* User Header Profile Card */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xl">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  {displayName}
                </h1>
                <span
                  className={cn(
                    'px-2 py-0.5 rounded text-xs font-semibold',
                    user.role === 'OWNER'
                      ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                      : user.role === 'TENANT'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                      : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  )}
                >
                  {user.role}
                </span>
                {user.isFlagged && (
                  <Badge variant="danger" className="text-xs">
                    ⚠️ Flagged ({user.rejectionCount} rejections)
                  </Badge>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">
                {user.email} {user.phone && `• ${user.phone}`}
              </p>
            </div>
          </div>

          <div className="flex flex-col md:items-end gap-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Account Status:</span>
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold',
                  user.status === 'ACTIVE' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                  user.status === 'SUSPENDED' && 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
                  user.status === 'DEACTIVATED' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                  user.status === 'BLOCKED' && 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                )}
              >
                {user.status}
              </span>
            </div>
            {user.statusReason && (
              <span className="text-xs text-gray-500 italic max-w-sm text-right">
                &quot;{user.statusReason}&quot;
              </span>
            )}
          </div>
        </div>

        {/* Highlight Alert if Flagged or has rejections */}
        {user.rejectionCount > 0 && (
          <div
            className={cn(
              'mt-5 p-4 rounded-xl text-sm flex items-start gap-3 border',
              user.isFlagged
                ? 'bg-red-50 text-red-900 border-red-200 dark:bg-red-950/30 dark:border-red-900'
                : 'bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900'
            )}
          >
            <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5 text-amber-600" />
            <div>
              <p className="font-semibold">
                Rejection History Warning ({user.rejectionCount} Total Rejections)
              </p>
              <p className="text-xs mt-0.5 opacity-90">
                {user.isFlagged
                  ? 'This user has exceeded the threshold for document or verification rejections. Review their submission details carefully before approving new changes.'
                  : 'This user has previous rejected submissions on record.'}
              </p>
            </div>
          </div>
        )}
      </Card>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-gray-800 gap-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={cn(
            'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'overview'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Profile Overview
        </button>

        <button
          onClick={() => setActiveTab('rejections')}
          className={cn(
            'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
            activeTab === 'rejections'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Rejection History
          {rejections.length > 0 && (
            <span className="h-5 px-1.5 rounded-full text-xs bg-red-100 text-red-700 dark:bg-red-950 font-bold">
              {rejections.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={cn(
            'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors flex items-center gap-1.5',
            activeTab === 'documents'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Submitted Documents ({allDocs.length})
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={cn(
            'pb-3 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          )}
        >
          Audit Log
        </button>
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-5 space-y-4">
            <CardTitle className="text-base">Account Information</CardTitle>
            <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">User ID</span>
                <span className="font-mono text-xs text-gray-900 dark:text-gray-100">{user.id}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Email Verified</span>
                <span>{user.isEmailVerified ? '✅ Yes' : '❌ No'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Phone Verified</span>
                <span>{user.isPhoneVerified ? '✅ Yes' : '❌ No'}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Joined On</span>
                <span className="text-gray-900 dark:text-gray-100">{formatDateTime(user.createdAt)}</span>
              </div>
              <div className="py-2.5 flex justify-between">
                <span className="text-gray-500">Last Login</span>
                <span className="text-gray-900 dark:text-gray-100">
                  {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'Never'}
                </span>
              </div>
            </div>
          </Card>

          {/* Role specific profile */}
          {user.role === 'OWNER' && ownerProfile && (
            <Card className="p-5 space-y-4">
              <CardTitle className="text-base">Owner Profile Details</CardTitle>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Business Name</span>
                  <span className="text-gray-900 dark:text-gray-100">{ownerProfile.businessName || '—'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Verification Status</span>
                  <Badge variant={ownerProfile.verificationStatus === 'VERIFIED' ? 'success' : 'warning'}>
                    {ownerProfile.verificationStatus}
                  </Badge>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">PAN Number</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">{ownerProfile.panNumber || '—'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Aadhaar Number</span>
                  <span className="font-mono text-gray-900 dark:text-gray-100">{ownerProfile.aadhaarNumber || '—'}</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Properties Managed</span>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    {ownerProfile._count?.buildings ?? 0} buildings
                  </span>
                </div>
              </div>
            </Card>
          )}

          {user.role === 'TENANT' && tenantProfile && (
            <Card className="p-5 space-y-4">
              <CardTitle className="text-base">Tenant Profile Details</CardTitle>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 text-sm">
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Identity Status</span>
                  <Badge variant={tenantProfile.isIdVerified ? 'success' : 'warning'}>
                    {tenantProfile.isIdVerified ? 'VERIFIED' : 'UNVERIFIED'}
                  </Badge>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Profile Completion</span>
                  <span className="font-semibold">{tenantProfile.profileCompletion}%</span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Current Stay</span>
                  <span>
                    {tenantProfile.currentBed
                      ? `${tenantProfile.currentBed.room.building.name} (Room ${tenantProfile.currentBed.room.roomNumber}, Bed ${tenantProfile.currentBed.bedLabel})`
                      : 'No active bed assigned'}
                  </span>
                </div>
                <div className="py-2.5 flex justify-between">
                  <span className="text-gray-500">Emergency Contact</span>
                  <span>
                    {tenantProfile.emergencyName
                      ? `${tenantProfile.emergencyName} (${tenantProfile.emergencyPhone || ''})`
                      : '—'}
                  </span>
                </div>
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Tab: Rejection History */}
      {activeTab === 'rejections' && (
        <Card className="p-5 space-y-4">
          <CardTitle className="text-base">Audit Trail of Rejections</CardTitle>
          {rejections.length === 0 ? (
            <p className="text-sm text-gray-500">No rejection records found for this account.</p>
          ) : (
            <div className="space-y-3">
              {rejections.map((rej, idx) => (
                <div
                  key={rej.id}
                  className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-sm space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-red-600 flex items-center gap-1.5">
                      <XCircle className="h-4 w-4" /> Rejection #{rejections.length - idx}: {rej.targetType}
                    </span>
                    <span className="text-xs text-gray-400">{formatDateTime(rej.createdAt)}</span>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 bg-white dark:bg-gray-900 p-2.5 rounded border border-gray-100 dark:border-gray-800">
                    &quot;{rej.reason}&quot;
                  </p>
                  {rej.adminId && (
                    <p className="text-[11px] text-gray-400">Reviewed by Admin ID: {rej.adminId}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Submitted Documents */}
      {activeTab === 'documents' && (
        <Card className="p-5 space-y-4">
          <CardTitle className="text-base">Uploaded Verification Documents</CardTitle>
          {allDocs.length === 0 ? (
            <p className="text-sm text-gray-500">No documents uploaded by this user.</p>
          ) : (
            <div className="space-y-2">
              {allDocs.map((doc) => (
                <DocumentRow key={doc.id} doc={doc} />
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Tab: Audit Log */}
      {activeTab === 'audit' && (
        <Card className="p-5 space-y-4">
          <CardTitle className="text-base">Recent Admin Actions on this Account</CardTitle>
          {recentAuditLogs.length === 0 ? (
            <p className="text-sm text-gray-500">No audit logs recorded for this user.</p>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-800">
              {recentAuditLogs.map((log) => (
                <div key={log.id} className="py-3 text-sm flex items-start justify-between gap-4">
                  <div>
                    <span className="font-mono font-semibold text-xs text-indigo-600 dark:text-indigo-400">
                      {log.action}
                    </span>
                    {log.metadata && (
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                        {JSON.stringify(log.metadata)}
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* ── Status Change Modal ── */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Update Account Status
              </h3>
              <button
                onClick={() => setStatusModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  New Status
                </label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="SUSPENDED">SUSPENDED</option>
                  <option value="DEACTIVATED">DEACTIVATED</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason / Notes (Optional)
                </label>
                <Textarea
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="State the reason for this status change..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStatusModalOpen(false)}
                disabled={updatingStatus}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                loading={updatingStatus}
                onClick={() => updateStatus()}
              >
                Save Status
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Role Change Modal ── */}
      {roleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-gray-200 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Change User Role
              </h3>
              <button
                onClick={() => setRoleModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Target Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-900 dark:text-gray-100"
                >
                  <option value="OWNER">OWNER</option>
                  <option value="TENANT">TENANT</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason for Role Change (Optional)
                </label>
                <Textarea
                  value={roleReason}
                  onChange={(e) => setRoleReason(e.target.value)}
                  placeholder="Reason for role change..."
                  rows={2}
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <input
                  type="checkbox"
                  id="force-toggle-detail"
                  checked={forceRoleChange}
                  onChange={(e) => setForceRoleChange(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="force-toggle-detail" className="text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-900 dark:text-gray-200">Force override</span>: Automatically deactivate active property listings or cancel pending bookings.
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRoleModalOpen(false)}
                disabled={updatingRole}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                loading={updatingRole}
                onClick={() => updateRole()}
              >
                Change Role
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ── */}
      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-red-200 dark:border-red-900">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Deactivate & Delete User</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-gray-100">{user.email}</span>?
            </p>

            <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg text-xs text-red-800 dark:text-red-300 space-y-1">
              <p className="font-medium">• Soft-deletes user record and sets status to DEACTIVATED.</p>
              <p>• Scrambles email and phone so the user can re-register cleanly if needed.</p>
              <p>• Immediately kills all active sessions and revokes all refresh tokens.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setDeleteModalOpen(false)}
                disabled={deletingUser}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="bg-red-600 hover:bg-red-700 text-white border-transparent"
                loading={deletingUser}
                onClick={() => deleteUser()}
              >
                Confirm Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

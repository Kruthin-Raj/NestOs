import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Search,
  AlertTriangle,
  Trash2,
  CheckCircle,
  XCircle,
  Ban,
  PauseCircle,
  ChevronLeft,
  ChevronRight,
  UserX,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { showToast } from '@/components/ui/toaster'
import { apiErrorMessage } from '@/lib/utils/api-error'
import { formatDateTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { User, UserRole, UserStatus } from '@/types'

const USERS_QUERY_KEY = ['admin', 'users'] as const

interface UsersApiResponse {
  users: Array<
    User & {
      displayName: string
      isFlagged: boolean
    }
  >
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  flagThreshold: number
}

export default function AdminUsersPage() {
  const qc = useQueryClient()

  // Filter & Pagination State
  const [page, setPage] = useState(1)
  const [limit] = useState(15)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [flaggedOnly, setFlaggedOnly] = useState<boolean>(false)

  // Active Modals State
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [statusModalOpen, setStatusModalOpen] = useState(false)
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)

  // Modal Form State
  const [newStatus, setNewStatus] = useState<UserStatus>('ACTIVE')
  const [statusReason, setStatusReason] = useState('')
  const [newRole, setNewRole] = useState<UserRole>('TENANT')
  const [roleReason, setRoleReason] = useState('')
  const [forceRoleChange, setForceRoleChange] = useState(false)

  // Fetch Users
  const { data, isLoading } = useQuery<UsersApiResponse>({
    queryKey: [...USERS_QUERY_KEY, { page, limit, search, role: roleFilter, status: statusFilter, isFlagged: flaggedOnly }],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = { page, limit }
      if (search.trim()) params.search = search.trim()
      if (roleFilter) params.role = roleFilter
      if (statusFilter) params.status = statusFilter
      if (flaggedOnly) params.isFlagged = true

      const res = await apiClient.get('/admin/users', { params })
      return res.data.data
    },
  })

  // Mutations
  const { mutate: updateStatus, isPending: updatingStatus } = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return
      await apiClient.patch(`/admin/users/${selectedUser.id}/status`, {
        status: newStatus,
        reason: statusReason.trim() || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      showToast('User status updated successfully', 'success')
      setStatusModalOpen(false)
      setStatusReason('')
    },
    onError: (err: unknown) => {
      showToast(apiErrorMessage(err, 'Failed to update user status'), 'error')
    },
  })

  const { mutate: updateRole, isPending: updatingRole } = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return
      await apiClient.patch(`/admin/users/${selectedUser.id}/role`, {
        role: newRole,
        force: forceRoleChange,
        reason: roleReason.trim() || undefined,
      })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      showToast('User role updated successfully', 'success')
      setRoleModalOpen(false)
      setRoleReason('')
      setForceRoleChange(false)
    },
    onError: (err: unknown) => {
      showToast(apiErrorMessage(err, 'Failed to update user role'), 'error')
    },
  })

  const { mutate: deleteUser, isPending: deletingUser } = useMutation({
    mutationFn: async () => {
      if (!selectedUser) return
      await apiClient.delete(`/admin/users/${selectedUser.id}`)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USERS_QUERY_KEY })
      showToast('User account deactivated and credentials released', 'success')
      setDeleteModalOpen(false)
    },
    onError: (err: unknown) => {
      showToast(apiErrorMessage(err, 'Failed to delete user'), 'error')
    },
  })

  const openStatusModal = (user: User) => {
    setSelectedUser(user)
    setNewStatus(user.status)
    setStatusReason(user.statusReason || '')
    setStatusModalOpen(true)
  }

  const openRoleModal = (user: User) => {
    setSelectedUser(user)
    setNewRole(user.role)
    setRoleReason('')
    setForceRoleChange(false)
    setRoleModalOpen(true)
  }

  const openDeleteModal = (user: User) => {
    setSelectedUser(user)
    setDeleteModalOpen(true)
  }

  const clearFilters = () => {
    setSearch('')
    setRoleFilter('')
    setStatusFilter('')
    setFlaggedOnly(false)
    setPage(1)
  }

  const users = data?.users ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Management"
        description="Search, filter, update account standing, manage roles, and review rejection history."
      />

      {/* Filters Bar */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="pl-9"
            />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Roles</option>
              <option value="OWNER">Owner</option>
              <option value="TENANT">Tenant</option>
              <option value="SUPER_ADMIN">Admin</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-200"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="DEACTIVATED">Deactivated</option>
              <option value="BLOCKED">Blocked</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setFlaggedOnly(!flaggedOnly)
                setPage(1)
              }}
              className={cn(
                'px-3 py-2 text-sm rounded-md border flex items-center gap-1.5 font-medium transition-colors',
                flaggedOnly
                  ? 'bg-red-50 border-red-300 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300'
                  : 'border-gray-300 bg-white dark:bg-gray-800 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50'
              )}
            >
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              Flagged Only
            </button>

            {(search || roleFilter || statusFilter || flaggedOnly) && (
              <Button size="sm" variant="ghost" onClick={clearFilters}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Users Table */}
      {isLoading ? (
        <PageLoader />
      ) : users.length === 0 ? (
        <EmptyState
          icon={<UserX className="h-12 w-12 text-gray-400" />}
          title="No users found"
          description="No users matched the selected filters or search query."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Rejections</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                {users.map((user) => {
                  const displayName =
                    user.ownerProfile?.fullName ||
                    user.tenantProfile?.fullName ||
                    user.email.split('@')[0]

                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        'hover:bg-gray-50/70 dark:hover:bg-gray-800/40 transition-colors',
                        user.isFlagged && 'bg-red-50/30 dark:bg-red-950/10'
                      )}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-300 font-semibold flex items-center justify-center text-xs">
                            {displayName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <Link
                                to={`/admin/users/${user.id}`}
                                className="font-medium text-gray-900 dark:text-gray-100 hover:text-indigo-600 dark:hover:text-indigo-400"
                              >
                                {displayName}
                              </Link>
                              {user.isFlagged && (
                                <Badge variant="danger" className="text-[10px] px-1 py-0 h-4">
                                  Flagged
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 flex items-center gap-2">
                              <span>{user.email}</span>
                              {user.phone && <span>• {user.phone}</span>}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={cn(
                            'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                            user.role === 'OWNER'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300'
                              : user.role === 'TENANT'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          )}
                        >
                          {user.role}
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex flex-col gap-0.5">
                          <span
                            className={cn(
                              'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold w-fit',
                              user.status === 'ACTIVE' && 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                              user.status === 'SUSPENDED' && 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
                              user.status === 'DEACTIVATED' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
                              user.status === 'BLOCKED' && 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300'
                            )}
                          >
                            {user.status === 'ACTIVE' && <CheckCircle className="h-3 w-3" />}
                            {user.status === 'SUSPENDED' && <PauseCircle className="h-3 w-3" />}
                            {user.status === 'DEACTIVATED' && <XCircle className="h-3 w-3" />}
                            {user.status === 'BLOCKED' && <Ban className="h-3 w-3" />}
                            {user.status}
                          </span>
                          {user.statusReason && (
                            <span className="text-[11px] text-gray-500 italic truncate max-w-xs" title={user.statusReason}>
                              &quot;{user.statusReason}&quot;
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'font-mono text-xs font-medium',
                              user.rejectionCount >= (data?.flagThreshold ?? 3)
                                ? 'text-red-600 font-bold'
                                : user.rejectionCount > 0
                                ? 'text-amber-600'
                                : 'text-gray-500'
                            )}
                          >
                            {user.rejectionCount}
                          </span>
                          {user.rejectionCount > 0 && (
                            <span className="text-[11px] text-gray-400">times</span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-gray-500">
                        <div>{formatDateTime(user.createdAt)}</div>
                        {user.lastLoginAt && (
                          <div className="text-[11px] text-gray-400">
                            Login: {formatDateTime(user.lastLoginAt)}
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to={`/admin/users/${user.id}`}>
                            <Button size="sm" variant="outline" className="h-8 text-xs">
                              Details
                            </Button>
                          </Link>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => openStatusModal(user)}
                            title="Update Status"
                          >
                            Status
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs"
                            onClick={() => openRoleModal(user)}
                            title="Change Role"
                          >
                            Role
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => openDeleteModal(user)}
                            title="Delete Account"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="px-5 py-3.5 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-between text-xs text-gray-500">
              <div>
                Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                {pagination.total} users
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>
                <span>
                  Page {pagination.page} of {pagination.totalPages}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Status Change Modal ── */}
      {statusModalOpen && selectedUser && (
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

            <p className="text-sm text-gray-500">
              Changing status for <span className="font-semibold text-gray-900 dark:text-gray-200">{selectedUser.email}</span>.
              Non-active statuses immediately terminate all active sessions.
            </p>

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
                  <option value="ACTIVE">ACTIVE (Normal Access)</option>
                  <option value="SUSPENDED">SUSPENDED (Temporary Hold)</option>
                  <option value="DEACTIVATED">DEACTIVATED (Account Disabled)</option>
                  <option value="BLOCKED">BLOCKED (Terminal Lockout)</option>
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
      {roleModalOpen && selectedUser && (
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

            <p className="text-sm text-gray-500">
              Current role: <span className="font-semibold">{selectedUser.role}</span>. Changing roles
              revises their permissions and ensures target profile initialization.
            </p>

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
                  id="force-toggle"
                  checked={forceRoleChange}
                  onChange={(e) => setForceRoleChange(e.target.checked)}
                  className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="force-toggle" className="text-xs text-gray-600 dark:text-gray-400">
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
      {deleteModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl max-w-md w-full p-6 space-y-4 border border-red-200 dark:border-red-900">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-lg font-semibold">Deactivate & Delete User</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">
              Are you sure you want to delete <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedUser.email}</span>?
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

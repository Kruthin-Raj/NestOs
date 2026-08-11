'use client'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, User } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/shared/status-badge'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { TableSkeleton } from '@/components/feedback/loading-state'
import { Badge } from '@/components/ui/badge'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS } from '@/lib/utils/constants'
import { formatRupees } from '@/lib/utils/format'

export default function OwnerTenantsPage() {
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.tenants.list({ search }),
    queryFn:  async () => {
      const params = search ? `?search=${encodeURIComponent(search)}` : ''
      const { data } = await apiClient.get(`/owner/tenants${params}`)
      return data.data
    },
  })

  const tenants = data?.items ?? []

  return (
    <div>
      <PageHeader
        title="Tenants"
        description="All tenants across your properties"
      />

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or phone..."
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <Card>
          <TableSkeleton />
        </Card>
      ) : !tenants.length ? (
        <EmptyState title="No tenants found" description="Your tenants will appear here once they book a room" />
      ) : (
        <Card padding={false}>
          <div className="divide-y divide-gray-100">
            {tenants.map((t: {
              id: string; fullName: string; phone?: string
              gender?: string; profession?: string
              building: { name: string }; room: { roomNumber: string }; bed: { bedLabel: string }
              isIdVerified: boolean; status: string
              currentMonthPayment: { status: string }
              monthlyRent: number
            }) => (
              <Link
                key={t.id}
                to={`/owner/tenants/${t.id}`}
                className="flex items-center justify-between p-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-indigo-700">
                      {t.fullName[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900">{t.fullName}</p>
                      {t.isIdVerified && (
                        <Badge variant="success" className="text-xs">Verified</Badge>
                      )}
                    </div>
                    <p className="text-xs text-gray-500">
                      {t.building.name} · Room {t.room.roomNumber}, Bed {t.bed.bedLabel}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{formatRupees(t.monthlyRent)}/mo</p>
                  <StatusBadge status={t.currentMonthPayment.status as never} />
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
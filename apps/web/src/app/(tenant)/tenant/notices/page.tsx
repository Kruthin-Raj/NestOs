import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { PageHeader } from '@/components/shared/page-header'
import { EmptyState } from '@/components/feedback/empty-state'
import { PageLoader } from '@/components/feedback/loading-state'
import apiClient from '@/lib/api/client'
import { QUERY_KEYS, NOTICE_CATEGORIES } from '@/lib/utils/constants'
import { relativeTime } from '@/lib/utils/format'
import { cn } from '@/lib/utils/cn'
import type { Notice } from '@/types'

const CATEGORY_COLORS: Record<string, string> = {
  MAINTENANCE:   'bg-orange-100 text-orange-700',
  SECURITY:      'bg-red-100 text-red-700',
  RENT_REMINDER: 'bg-amber-100 text-amber-700',
  VISITOR:       'bg-blue-100 text-blue-700',
  DELIVERY:      'bg-teal-100 text-teal-700',
  RULE_REMINDER: 'bg-purple-100 text-purple-700',
  GENERAL:       'bg-gray-100 text-gray-700',
}

export default function TenantNoticesPage() {
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.notices.tenant(),
    queryFn:  async () => {
      const { data } = await apiClient.get('/tenant/notices')
      return data.data
    },
  })

  const { mutate: markRead } = useMutation({
    mutationFn: (noticeId: string) =>
      apiClient.post(`/tenant/notices/${noticeId}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.notices.tenant() })
    },
  })

  const notices: Notice[] = data?.items ?? []
  const unreadCount = data?.unreadCount ?? 0

  return (
    <div>
      <PageHeader
        title="Notices"
        description={unreadCount > 0 ? `${unreadCount} unread notice${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
      />

      {isLoading ? (
        <PageLoader />
      ) : !notices.length ? (
        <EmptyState
          icon={<Bell className="h-12 w-12" />}
          title="No notices yet"
          description="Notices from your owner will appear here"
        />
      ) : (
        <div className="space-y-3">
          {notices.map((n) => (
            <div
              key={n.id}
              className={cn(
                'bg-white rounded-xl border p-4 cursor-pointer',
                !n.isRead ? 'border-blue-200 shadow-sm' : 'border-gray-200'
              )}
              onClick={() => !n.isRead && markRead(n.id)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {!n.isRead && (
                      <div className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                    )}
                    <h3 className={cn(
                      'text-sm text-gray-900',
                      !n.isRead && 'font-semibold'
                    )}>
                      {n.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{n.body}</p>
                  <p className="text-xs text-gray-400 mt-2">{relativeTime(n.publishAt)}</p>
                </div>
                <span className={cn(
                  'px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0',
                  CATEGORY_COLORS[n.category] ?? 'bg-gray-100 text-gray-600'
                )}>
                  {NOTICE_CATEGORIES.find((c) => c.value === n.category)?.label ?? n.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
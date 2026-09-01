import { Badge } from '../ui/badge'
import type {
  BuildingStatus, BedStatus, BookingStatus,
  PaymentStatus, IssueStatus, IssuePriority,
  OwnerVerificationStatus, TenantStatus, UserStatus,
} from '@/types'

type AnyStatus =
  | BuildingStatus | BedStatus | BookingStatus
  | PaymentStatus  | IssueStatus | IssuePriority
  | OwnerVerificationStatus | TenantStatus | UserStatus

type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple'

const STATUS_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  // Building
  DRAFT:       { label: 'Draft',       variant: 'default' },
  ACTIVE:      { label: 'Active',      variant: 'success' },
  INACTIVE:    { label: 'Inactive',    variant: 'default' },
  UNDER_REVIEW:{ label: 'Under Review',variant: 'warning' },

  // User
  SUSPENDED:   { label: 'Suspended',   variant: 'warning' },
  DEACTIVATED: { label: 'Deactivated', variant: 'default' },
  BLOCKED:     { label: 'Blocked',     variant: 'danger' },

  // Bed
  VACANT:      { label: 'Vacant',      variant: 'success' },
  RESERVED:    { label: 'Reserved',    variant: 'warning' },
  OCCUPIED:    { label: 'Occupied',    variant: 'info' },
  BLOCKED_BED: { label: 'Blocked',     variant: 'default' },

  // Booking
  PENDING:     { label: 'Pending',     variant: 'warning' },
  CONFIRMED:   { label: 'Confirmed',   variant: 'success' },
  CANCELLED:   { label: 'Cancelled',   variant: 'default' },
  COMPLETED:   { label: 'Completed',   variant: 'info' },
  FAILED:      { label: 'Failed',      variant: 'danger' },

  // Payment
  SUCCESS:     { label: 'Paid',        variant: 'success' },
  REFUNDED:    { label: 'Refunded',    variant: 'info' },

  // Issue
  OPEN:        { label: 'Open',        variant: 'warning' },
  IN_PROGRESS: { label: 'In Progress', variant: 'info' },
  RESOLVED:    { label: 'Resolved',    variant: 'success' },
  REJECTED:    { label: 'Rejected',    variant: 'danger' },
  REOPENED:    { label: 'Reopened',    variant: 'purple' },

  // Priority
  LOW:         { label: 'Low',         variant: 'default' },
  MEDIUM:      { label: 'Medium',      variant: 'warning' },
  HIGH:        { label: 'High',        variant: 'danger' },
  URGENT:      { label: 'Urgent',      variant: 'danger' },

  // Verification
  SUBMITTED:   { label: 'Submitted',   variant: 'info' },
  VERIFIED:    { label: 'Verified',    variant: 'success' },

  // Tenant
  ONBOARDING:  { label: 'Onboarding',  variant: 'warning' },
  SEARCHING:   { label: 'Searching',   variant: 'info' },
  MOVED_OUT:   { label: 'Moved Out',   variant: 'default' },
}

export function StatusBadge({ status }: { status: AnyStatus }) {
  const config = STATUS_MAP[status] ?? { label: status, variant: 'default' as BadgeVariant }
  return <Badge variant={config.variant}>{config.label}</Badge>
}
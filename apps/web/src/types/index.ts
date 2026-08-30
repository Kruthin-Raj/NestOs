export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export interface PaginatedData<T> {
  items: T[]
  pagination: PaginationMeta
}

export type UserRole = 'SUPER_ADMIN' | 'OWNER' | 'TENANT'
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'BLOCKED'

export interface User {
  id: string
  email: string
  phone?: string | null
  role: UserRole
  status: UserStatus
  statusReason?: string | null
  statusUpdatedAt?: string | null
  statusUpdatedBy?: string | null
  rejectionCount: number
  isFlagged?: boolean
  isEmailVerified: boolean
  isPhoneVerified: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt?: string
  ownerProfile?: {
    id: string
    fullName: string
    verificationStatus: OwnerVerificationStatus
    businessName?: string
  }
  tenantProfile?: {
    id: string
    fullName: string
    status: TenantStatus
    profileCompletion: number
  }
}

export type OwnerVerificationStatus =
  | 'PENDING' | 'SUBMITTED' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED'

export type TenantStatus =
  | 'ONBOARDING' | 'SEARCHING' | 'RESERVED' | 'ACTIVE' | 'MOVED_OUT'

export type BuildingType   = 'PG' | 'HOSTEL' | 'APARTMENT' | 'SHARED_FLAT'
export type BuildingStatus = 'DRAFT' | 'ACTIVE' | 'INACTIVE' | 'UNDER_REVIEW'
export type GenderPref     = 'MALE' | 'FEMALE' | 'CO_ED'
export type BedStatus      = 'VACANT' | 'RESERVED' | 'OCCUPIED' | 'BLOCKED'
export type BookingStatus  = 'PENDING' | 'CONFIRMED' | 'CANCELLED' | 'COMPLETED' | 'FAILED'
export type PaymentStatus  = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED'
export type PaymentType    = 'BOOKING_DEPOSIT' | 'SECURITY_DEPOSIT' | 'RENT' | 'PENALTY'
export type IssueStatus    = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'REJECTED' | 'REOPENED'
export type IssuePriority  = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface Building {
  id: string
  name: string
  type: BuildingType
  status: BuildingStatus
  genderPreference: GenderPref
  addressLine1: string
  addressLine2?: string
  landmark?: string
  city: string
  state: string
  pincode: string
  latitude?: number
  longitude?: number
  totalFloors: number
  description?: string
  rules?: string
  depositMonths: number
  rentDueDay: number
  contactPhone?: string
  contactEmail?: string
  googleMapsUrl?: string
  totalBeds: number
  occupiedBeds: number
  amenities: Array<{ name: string }>
  photos: Array<{ fileUrl: string; caption?: string; sortOrder: number }>
  floors?: Floor[]
  createdAt: string
}

export interface Floor {
  id: string
  buildingId: string
  floorNumber: number
  label?: string
  rooms?: Room[]
}

export interface Room {
  id: string
  roomNumber: string
  type: 'PRIVATE' | 'SHARED' | 'DORMITORY'
  capacity: number
  currentCount: number
  baseRent: number
  amenities: Array<{ name: string }>
  beds: Bed[]
}

export interface Bed {
  id: string
  bedLabel: string
  status: BedStatus
  monthlyRent: number
  notes?: string
  currentTenant?: {
    id: string
    fullName: string
    phone?: string
    moveInDate?: string
    paymentStatus?: string
  }
}

export interface Booking {
  id: string
  status: BookingStatus
  moveInDate: string
  monthlyRent: number
  depositAmount: number
  depositPaid: boolean
  building: {
    id: string
    name: string
    addressLine1: string
    city: string
    contactPhone?: string
  }
  room: { roomNumber: string; type: string }
  bed:  { bedLabel: string }
}

export interface Payment {
  id: string
  type: PaymentType
  status: PaymentStatus
  amountRupees: number
  billingMonth?: number
  billingYear?: number
  upiTransactionId?: string
  receiptNumber?: string
  createdAt: string
  building?: { name: string }
}

export interface Issue {
  id: string
  title: string
  description: string
  category: string
  priority: IssuePriority
  status: IssueStatus
  photoUrls: string[]
  canReopen?: boolean
  reopenDeadline?: string
  createdAt: string
  updatedAt: string
  building?: { name: string }
  room?: { roomNumber: string }
  tenant?: { fullName: string }
  latestComment?: {
    authorRole: 'OWNER' | 'TENANT'
    body: string
    createdAt: string
  }
  comments?: IssueComment[]
}

export interface IssueComment {
  id: string
  authorRole: 'OWNER' | 'TENANT'
  body: string
  photoUrls: string[]
  createdAt: string
}

export interface Notice {
  id: string
  title: string
  body: string
  category: string
  publishAt: string
  expiresAt?: string
  isRead?: boolean
  readAt?: string
  readCount?: number
  targetType: string
  targetBuilding?: { name: string }
  createdAt: string
}

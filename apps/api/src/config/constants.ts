// ─────────────────────────────────────────────────────────────
// App-wide constants — never hardcode these elsewhere
// ─────────────────────────────────────────────────────────────

export const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
} as const

export const OTP = {
  LENGTH: 6,
  MAX_ATTEMPTS: 3,
  EXPIRY_MINUTES: 10,
} as const

export const JWT = {
  ACCESS_COOKIE_NAME: 'nestos_token',
  REFRESH_COOKIE_NAME: 'nestos_refresh',
} as const

export const UPLOAD = {
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,  // 10 MB
  ALLOWED_MIME_TYPES: [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ],
  PRESIGNED_URL_EXPIRY_SECONDS: 300,       // 5 minutes
} as const

export const BOOKING = {
  MAX_ADVANCE_DAYS: 60,          // can book up to 60 days in advance
  PENDING_EXPIRY_MINUTES: 30,    // booking expires if not paid in 30 mins
} as const

export const ISSUE = {
  REOPEN_WINDOW_HOURS: 72,       // tenant can reopen within 72 hours of resolution
} as const

export const RECEIPT = {
  PREFIX: 'NOS',                 // receipt numbers: NOS-2025-03-00142
} as const

export const PROFILE = {
  MIN_COMPLETION_TO_BOOK: 70,    // tenant needs 70% profile completion to book
} as const
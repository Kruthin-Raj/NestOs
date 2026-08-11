import { PAGINATION } from '@config/constants'

// ─────────────────────────────────────────────────────────────
// Parse and sanitize pagination query params from a request
// ─────────────────────────────────────────────────────────────
export interface ParsedPagination {
  page: number
  limit: number
  skip: number   // Prisma's offset = (page - 1) * limit
}

export function parsePagination(query: Record<string, unknown>): ParsedPagination {
  const page = Math.max(1, parseInt(String(query.page ?? PAGINATION.DEFAULT_PAGE), 10) || 1)
  const requestedLimit = parseInt(String(query.limit ?? PAGINATION.DEFAULT_LIMIT), 10) || PAGINATION.DEFAULT_LIMIT
  const limit = Math.min(requestedLimit, PAGINATION.MAX_LIMIT)
  const skip = (page - 1) * limit

  return { page, limit, skip }
}
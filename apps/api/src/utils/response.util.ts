import { Response } from 'express'

// ─────────────────────────────────────────────────────────────
// Pagination metadata builder
// ─────────────────────────────────────────────────────────────
export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export function buildPaginationMeta(
  page: number,
  limit: number,
  total: number
): PaginationMeta {
  const totalPages = Math.ceil(total / limit)
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}

// ─────────────────────────────────────────────────────────────
// Success responses
// ─────────────────────────────────────────────────────────────

// Standard success (200 or 201)
export function sendSuccess<T>(
  res: Response,
  message: string,
  data: T,
  statusCode = 200
): Response {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  })
}

// Created (201)
export function sendCreated<T>(
  res: Response,
  message: string,
  data: T
): Response {
  return sendSuccess(res, message, data, 201)
}

// No content (204) — used for DELETE
export function sendNoContent(res: Response): Response {
  return res.status(204).send()
}

// Paginated success
export function sendPaginated<T>(
  res: Response,
  message: string,
  items: T[],
  pagination: PaginationMeta,
  extra?: Record<string, unknown>
): Response {
  return res.status(200).json({
    success: true,
    message,
    data: {
      items,
      pagination,
      ...extra,
    },
  })
}

// ─────────────────────────────────────────────────────────────
// Error responses — prefer throwing AppError in services,
// but these helpers can be used directly in edge cases
// ─────────────────────────────────────────────────────────────

export function sendError(
  res: Response,
  message: string,
  statusCode: number,
  code: string,
  details?: unknown
): Response {
  return res.status(statusCode).json({
    success: false,
    message,
    error: { code, details },
  })
}
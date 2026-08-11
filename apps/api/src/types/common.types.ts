// ─────────────────────────────────────────────────────────────
// Shared type helpers used across modules
// ─────────────────────────────────────────────────────────────

// Prisma partial update — all fields optional except id
export type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

// Express async handler — wraps async controllers
import { Request, Response, NextFunction } from 'express'
export type AsyncHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>

// Pagination query params
export interface PaginationQuery {
  page?: string
  limit?: string
}

// Sort direction
export type SortOrder = 'asc' | 'desc'
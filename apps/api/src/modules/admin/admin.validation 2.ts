import { z } from 'zod'
import { UserRole, UserStatus } from '@prisma/client'

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().optional(),
  role: z.nativeEnum(UserRole).optional(),
  status: z.nativeEnum(UserStatus).optional(),
  isFlagged: z.preprocess((val) => val === 'true' || val === true, z.boolean()).optional(),
  sortBy: z.enum(['createdAt', 'lastLoginAt', 'rejectionCount']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type ListUsersQueryDto = z.infer<typeof listUsersQuerySchema>

export const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: z.string().max(500).optional(),
})

export type UpdateUserStatusDto = z.infer<typeof updateUserStatusSchema>

export const updateUserRoleSchema = z.object({
  role: z.nativeEnum(UserRole),
  force: z.boolean().optional().default(false),
  reason: z.string().max(500).optional(),
})

export type UpdateUserRoleDto = z.infer<typeof updateUserRoleSchema>

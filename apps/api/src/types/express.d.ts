import { UserRole } from '@prisma/client'

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string
        role: UserRole
        email: string
      }
      resourceOwnerId?: string
    }
  }
}

export {}
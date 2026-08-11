import { Request, Response, NextFunction } from 'express'
import { sendSuccess } from '@utils/response.util'
import {
  getFullProfileService,
  updateOwnerProfileService,
  updateTenantProfileService,
  updatePreferencesService,
} from './users.service'

type AuthenticatedRequest = Request & {
  user?: {
    userId: string
    role: 'SUPER_ADMIN' | 'OWNER' | 'TENANT'
    email: string
  }
}

export async function getProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await getFullProfileService(req.user!.userId, req.user!.role)
    sendSuccess(res, 'Profile fetched', result)
  } catch (err) {
    next(err)
  }
}

export async function updateProfile(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { userId, role } = req.user!

    const result =
      role === 'OWNER'
        ? await updateOwnerProfileService(userId, req.body)
        : await updateTenantProfileService(userId, req.body)

    sendSuccess(res, 'Profile updated', result)
  } catch (err) {
    next(err)
  }
}

export async function updatePreferences(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await updatePreferencesService(req.user!.userId, req.body)
    sendSuccess(res, 'Preferences updated', result)
  } catch (err) {
    next(err)
  }
}
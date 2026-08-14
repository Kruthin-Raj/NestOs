import { Router, Request, Response } from 'express'
import { authenticate } from '@middleware/auth.middleware'
import { sendError } from '@utils/response.util'
import { logger } from '@utils/logger'

export const uploadsRouter: ReturnType<typeof Router> = Router()

// Every upload endpoint requires a logged-in user, stub or not.
uploadsRouter.use(authenticate)

// ─────────────────────────────────────────────────────────────
// NOT IMPLEMENTED.
//
// The web client expects a presigned-URL flow:
//   POST /uploads/presigned-url -> { uploadUrl, fileKey }
//   PUT  <uploadUrl>            (raw file body)
//   POST /uploads/confirm       -> persists Owner/TenantDocument
//
// The API is configured for local disk (env.UPLOAD_DIR) and has no
// object-storage client. Implementing this stores government ID
// documents, so it is tracked as its own change with its own tests.
// Until then these endpoints fail explicitly rather than silently.
//
// Blocker for the real implementation: app.ts serves the whole
// UPLOAD_DIR through unauthenticated express.static. That must be
// replaced with an authenticated read route first.
// ─────────────────────────────────────────────────────────────
function notImplemented(route: string) {
  return (_req: Request, res: Response): Response => {
    logger.warn(`Upload endpoint called but not implemented: ${route}`, 'Uploads')
    return sendError(
      res,
      'File uploads are not available yet.',
      501,
      'NOT_IMPLEMENTED'
    )
  }
}

uploadsRouter.post('/presigned-url', notImplemented('POST /uploads/presigned-url'))
uploadsRouter.post('/confirm',       notImplemented('POST /uploads/confirm'))

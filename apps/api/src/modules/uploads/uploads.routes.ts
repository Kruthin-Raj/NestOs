import fs from 'fs'
import { Router } from 'express'
import { z } from 'zod'
import { UPLOAD } from '@config/constants'
import { authenticate } from '@middleware/auth.middleware'
import { validate } from '@middleware/validate.middleware'
import { asyncHandler } from '@utils/async-handler'
import { sendSuccess, sendCreated } from '@utils/response.util'
import {
  createUploadUrlService,
  storeUploadedFileService,
  confirmUploadService,
  getDocumentFileService,
} from './uploads.service'

const documentTypeEnum = z.enum([
  'AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_CARD', 'PASSPORT', 'DRIVING_LICENCE',
  'VOTER_ID', 'PROPERTY_DEED', 'LEASE_AGREEMENT', 'UTILITY_BILL',
  'PROPERTY_TAX', 'SELFIE', 'OTHER',
])

const presignedUrlSchema = z.object({
  documentType:  documentTypeEnum,
  fileName:      z.string().min(1).max(255),
  mimeType:      z.string().min(1).max(100),
  fileSizeBytes: z.number().int().positive(),
})

const confirmSchema = z.object({
  fileKey:       z.string().min(1).max(300),
  documentType:  documentTypeEnum,
  fileName:      z.string().max(255).optional(),
  fileSizeBytes: z.number().int().positive().optional(),
  // Constrained to the same allowlist as /presigned-url. This value is stored
  // and later echoed back as the Content-Type of the download, so accepting an
  // arbitrary string here would let a caller choose how their own file is
  // rendered in a reviewing admin's browser.
  mimeType:      z.enum(UPLOAD.ALLOWED_MIME_TYPES).optional(),
})

export const uploadsRouter: ReturnType<typeof Router> = Router()

// POST /api/v1/uploads/presigned-url
uploadsRouter.post('/presigned-url',
  authenticate,
  validate(presignedUrlSchema),
  asyncHandler(async (req, res) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`
    const result  = await createUploadUrlService(
      req.user!.userId,
      req.user!.role,
      req.body,
      baseUrl
    )
    sendSuccess(res, 'Upload URL created', result)
  })
)

// PUT /api/v1/uploads/raw/:uploadToken
//
// Intentionally NOT behind `authenticate`: the browser sends the raw file with
// fetch(), which carries no cookies. The signed, short-lived token in the path
// is the authorization, and it — not any request field — determines the
// destination path. The body is streamed straight to disk; express.json ignores
// it because the Content-Type is an image or PDF.
uploadsRouter.put('/raw/:uploadToken',
  asyncHandler<{ uploadToken: string }>(async (req, res) => {
    const contentLengthHeader = req.get('content-length')

    const result = await storeUploadedFileService(
      req.params.uploadToken,
      req.get('content-type'),
      contentLengthHeader ? Number(contentLengthHeader) : undefined,
      req
    )

    sendSuccess(res, 'File uploaded', {
      fileKey:      result.fileKey,
      bytesWritten: result.bytesWritten,
    })
  })
)

// POST /api/v1/uploads/confirm
uploadsRouter.post('/confirm',
  authenticate,
  validate(confirmSchema),
  asyncHandler(async (req, res) => {
    const document = await confirmUploadService(
      req.user!.userId,
      req.user!.role,
      req.body
    )
    sendCreated(res, 'Document uploaded', document)
  })
)

// GET /api/v1/uploads/documents/:documentId
//
// The only way to read an uploaded document. Replaces the express.static mount
// that used to serve the whole upload directory with no authorization at all.
uploadsRouter.get('/documents/:documentId',
  authenticate,
  asyncHandler<{ documentId: string }>(async (req, res) => {
    const file = await getDocumentFileService(
      req.params.documentId,
      req.user!.userId,
      req.user!.role
    )

    res.setHeader('Content-Type', file.mimeType)
    // attachment, and no-store: these are identity documents — keep them out of
    // shared caches and out of the browser's inline renderer.
    //
    // The admin viewer does NOT need `inline`. It fetches with
    // responseType: 'blob' and renders a blob: URL, and XHR ignores
    // Content-Disposition entirely — this header only applies when the browser
    // navigates to the URL directly.
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(file.fileName)}"`)
    res.setHeader('Cache-Control', 'no-store, private')

    fs.createReadStream(file.absolutePath).pipe(res)
  })
)

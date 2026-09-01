import fs from 'fs'
import fsp from 'fs/promises'
import path from 'path'
import { pipeline } from 'stream/promises'
import { Readable, Transform } from 'stream'
import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { DocumentType, UserRole } from '@prisma/client'
import { prisma } from '@config/prisma'
import { env } from '@config/env'
import { UPLOAD } from '@config/constants'
import { logger } from '@utils/logger'
import {
  BadRequestError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '@utils/errors'

// Documents are user PII (Aadhaar, PAN, selfies). Everything here assumes the
// files must never be reachable without an authorization check — see
// getDocumentFileService and the deliberate absence of any static mount.

const MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg':       '.jpg',
  'image/png':        '.png',
  'image/webp':       '.webp',
  'application/pdf':  '.pdf',
}

// owner|tenant / <profile uuid> / <DOCUMENT_TYPE>-<uuid>.<ext>
const FILE_KEY_PATTERN =
  /^(owner|tenant)\/[0-9a-f-]{36}\/[A-Z_]{1,30}-[0-9a-f-]{36}\.(jpg|png|webp|pdf)$/

interface UploadTokenPayload {
  fileKey:  string
  userId:   string
  mimeType: string
  maxBytes: number
}

/** Absolute path for a fileKey, guaranteed to sit inside UPLOAD_DIR. */
function resolveUploadPath(fileKey: string): string {
  if (!FILE_KEY_PATTERN.test(fileKey)) {
    throw new BadRequestError('Malformed file key', 'INVALID_FILE_KEY')
  }

  const root = path.resolve(env.UPLOAD_DIR)
  const full = path.resolve(root, fileKey)

  // Belt and braces: the pattern already forbids traversal, but a resolved
  // path that escapes the root must never be touched.
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new BadRequestError('Malformed file key', 'INVALID_FILE_KEY')
  }

  return full
}

/** The `<scope>/<profileId>/` prefix the caller is allowed to write under. */
async function getOwnedPrefix(
  userId: string,
  role: UserRole
): Promise<{ prefix: string; scope: 'owner' | 'tenant'; profileId: string }> {
  if (role === 'OWNER') {
    const profile = await prisma.ownerProfile.findUnique({
      where: { userId }, select: { id: true },
    })
    if (!profile) throw new NotFoundError('Owner profile not found')
    return { prefix: `owner/${profile.id}/`, scope: 'owner', profileId: profile.id }
  }

  if (role === 'TENANT') {
    const profile = await prisma.tenantProfile.findUnique({
      where: { userId }, select: { id: true },
    })
    if (!profile) throw new NotFoundError('Tenant profile not found')
    return { prefix: `tenant/${profile.id}/`, scope: 'tenant', profileId: profile.id }
  }

  throw new ForbiddenError('Only owners and tenants can upload documents')
}

// ─────────────────────────────────────────────────────────────
// 1. Issue a short-lived upload URL
//
// There is no object store here, so the "presigned URL" points back at this
// API. The signed token — not any client-supplied value — decides where the
// bytes land, which is what makes the PUT route safe to leave unauthenticated.
// ─────────────────────────────────────────────────────────────
export async function createUploadUrlService(
  userId: string,
  role: UserRole,
  dto: {
    documentType:  DocumentType
    fileName:      string
    mimeType:      string
    fileSizeBytes: number
  },
  baseUrl: string
) {
  if (!UPLOAD.ALLOWED_MIME_TYPES.includes(dto.mimeType as never)) {
    throw new BadRequestError(
      `Unsupported file type. Allowed: ${UPLOAD.ALLOWED_MIME_TYPES.join(', ')}`,
      'UNSUPPORTED_MIME_TYPE'
    )
  }

  if (dto.fileSizeBytes > UPLOAD.MAX_FILE_SIZE_BYTES) {
    throw new BadRequestError(
      `File is too large. Maximum ${UPLOAD.MAX_FILE_SIZE_BYTES / (1024 * 1024)} MB.`,
      'FILE_TOO_LARGE'
    )
  }

  const { prefix } = await getOwnedPrefix(userId, role)
  const extension = MIME_EXTENSIONS[dto.mimeType]
  const fileKey   = `${prefix}${dto.documentType}-${uuidv4()}${extension}`

  const payload: UploadTokenPayload = {
    fileKey,
    userId,
    mimeType: dto.mimeType,
    maxBytes: UPLOAD.MAX_FILE_SIZE_BYTES,
  }

  const uploadToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: UPLOAD.PRESIGNED_URL_EXPIRY_SECONDS,
    issuer:    'nestos-upload',
  })

  return {
    // Absolute: the browser calls this with fetch() from the web origin, so a
    // relative path would hit the frontend dev server instead of the API.
    uploadUrl:         `${baseUrl}/api/v1/uploads/raw/${uploadToken}`,
    fileKey,
    expiresInSeconds:  UPLOAD.PRESIGNED_URL_EXPIRY_SECONDS,
  }
}

// ─────────────────────────────────────────────────────────────
// 2. Receive the bytes
// ─────────────────────────────────────────────────────────────
export async function storeUploadedFileService(
  uploadToken: string,
  contentType: string | undefined,
  contentLength: number | undefined,
  body: Readable
): Promise<{ fileKey: string; bytesWritten: number }> {
  let payload: UploadTokenPayload
  try {
    payload = jwt.verify(uploadToken, env.JWT_ACCESS_SECRET, {
      issuer: 'nestos-upload',
    }) as UploadTokenPayload
  } catch {
    throw new UnauthorizedError('Upload link is invalid or has expired', 'UPLOAD_TOKEN_INVALID')
  }

  if (contentType && contentType.split(';')[0].trim() !== payload.mimeType) {
    throw new BadRequestError(
      'Content-Type does not match the type this upload link was issued for',
      'MIME_TYPE_MISMATCH'
    )
  }

  if (contentLength !== undefined && contentLength > payload.maxBytes) {
    throw new BadRequestError('File is too large', 'FILE_TOO_LARGE')
  }

  const fullPath = resolveUploadPath(payload.fileKey)
  await fsp.mkdir(path.dirname(fullPath), { recursive: true })

  // Count as we stream: Content-Length is a client claim, so the cap has to be
  // enforced against the bytes actually received.
  let bytesWritten = 0
  let aborted = false

  const counter = new Transform({
    transform(chunk: Buffer, _enc, cb) {
      bytesWritten += chunk.length
      if (bytesWritten > payload.maxBytes) {
        aborted = true
        return cb(new BadRequestError('File is too large', 'FILE_TOO_LARGE'))
      }
      cb(null, chunk)
    },
  })

  try {
    await pipeline(body, counter, fs.createWriteStream(fullPath))
  } catch (err) {
    // Never leave a partial file behind.
    await fsp.rm(fullPath, { force: true }).catch(() => undefined)
    if (aborted) {
      throw new BadRequestError('File is too large', 'FILE_TOO_LARGE')
    }
    throw err
  }

  if (bytesWritten === 0) {
    await fsp.rm(fullPath, { force: true }).catch(() => undefined)
    throw new BadRequestError('Uploaded file is empty', 'EMPTY_FILE')
  }

  logger.info(`Stored upload (${bytesWritten} bytes)`, 'Uploads')
  return { fileKey: payload.fileKey, bytesWritten }
}

// ─────────────────────────────────────────────────────────────
// 3. Confirm — persist the document row
// ─────────────────────────────────────────────────────────────
export async function confirmUploadService(
  userId: string,
  role: UserRole,
  dto: {
    fileKey:        string
    documentType:   DocumentType
    fileName?:      string
    fileSizeBytes?: number
    mimeType?:      string
  }
) {
  const { prefix, scope, profileId } = await getOwnedPrefix(userId, role)

  // The fileKey arrives from the client, so ownership must be re-checked here.
  // Without this, one user could attach another user's document to themselves.
  if (!dto.fileKey.startsWith(prefix)) {
    throw new ForbiddenError('That file does not belong to you')
  }

  const fullPath = resolveUploadPath(dto.fileKey)
  const stat = await fsp.stat(fullPath).catch(() => null)
  if (!stat?.isFile()) {
    throw new BadRequestError('No uploaded file found for that key', 'FILE_NOT_UPLOADED')
  }

  // Served through GET /uploads/documents/:id, never as a static path.
  const fileUrl = `/api/v1/uploads/documents`

  const data = {
    documentType:  dto.documentType,
    fileUrl,
    fileKey:       dto.fileKey,
    fileName:      dto.fileName ?? null,
    fileSizeBytes: stat.size,
    mimeType:      dto.mimeType ?? null,
  }

  const document = scope === 'owner'
    ? await prisma.ownerDocument.create({ data: { ...data, ownerId: profileId } })
    : await prisma.tenantDocument.create({ data: { ...data, tenantId: profileId } })

  await prisma.auditLog.create({
    data: {
      actorId:    userId,
      actorRole:  role,
      action:     'DOCUMENT_UPLOADED',
      entityType: scope === 'owner' ? 'owner_documents' : 'tenant_documents',
      entityId:   document.id,
      // Deliberately no file key, name or contents.
      metadata:   { documentType: dto.documentType },
    },
  })

  return {
    id:           document.id,
    documentType: document.documentType,
    fileName:     document.fileName,
    status:       document.status,
    createdAt:    document.createdAt,
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Authenticated read — replaces the public express.static mount
// ─────────────────────────────────────────────────────────────
export async function getDocumentFileService(
  documentId: string,
  viewerUserId: string,
  viewerRole: UserRole
): Promise<{ absolutePath: string; mimeType: string; fileName: string }> {
  const ownerDoc = await prisma.ownerDocument.findUnique({
    where:  { id: documentId },
    select: { fileKey: true, mimeType: true, fileName: true, owner: { select: { userId: true } } },
  })

  const tenantDoc = ownerDoc ? null : await prisma.tenantDocument.findUnique({
    where:  { id: documentId },
    select: { fileKey: true, mimeType: true, fileName: true, tenant: { select: { userId: true } } },
  })

  const doc = ownerDoc ?? tenantDoc
  if (!doc) throw new NotFoundError('Document not found')

  const ownerUserId = ownerDoc
    ? ownerDoc.owner.userId
    : tenantDoc!.tenant.userId

  // Admins review verification documents; everyone else sees only their own.
  const isSelf  = ownerUserId === viewerUserId
  const isAdmin = viewerRole === 'SUPER_ADMIN'
  if (!isSelf && !isAdmin) {
    throw new ForbiddenError('You do not have permission to view this document')
  }

  const absolutePath = resolveUploadPath(doc.fileKey)
  const exists = await fsp.stat(absolutePath).then((s) => s.isFile()).catch(() => false)
  if (!exists) throw new NotFoundError('Document file is missing from storage')

  // Rows written before the confirm route constrained mimeType may hold any
  // string, and this value becomes the response Content-Type. Anything not on
  // the allowlist is served as an opaque download rather than trusted.
  const storedMime = doc.mimeType ?? ''
  const mimeType = UPLOAD.ALLOWED_MIME_TYPES.includes(storedMime as never)
    ? storedMime
    : 'application/octet-stream'

  return {
    absolutePath,
    mimeType,
    fileName: doc.fileName ?? path.basename(absolutePath),
  }
}

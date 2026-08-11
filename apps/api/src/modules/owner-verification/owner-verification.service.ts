import { prisma } from '@config/prisma'
import { BadRequestError, ConflictError, NotFoundError } from '@utils/errors'
import { SubmitVerificationDto } from './owner-verification.validation'
import { DocumentType } from '@prisma/client'

// Required document types for verification to be submitted
const REQUIRED_IDENTITY_DOCS: DocumentType[] = ['AADHAAR_FRONT', 'AADHAAR_BACK']
const REQUIRED_PROPERTY_DOC_MIN = 1 // at least one property document

const PROPERTY_DOC_TYPES: DocumentType[] = [
  'PROPERTY_DEED', 'LEASE_AGREEMENT', 'UTILITY_BILL', 'PROPERTY_TAX',
]

// ─────────────────────────────────────────────────────────────
// getVerificationStatus
// ─────────────────────────────────────────────────────────────
export async function getVerificationStatusService(ownerId: string) {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: ownerId },
    include: { documents: true },
  })
  if (!profile) throw new NotFoundError('Owner profile not found')

  const identityDocs = profile.documents.filter(
    (d) => REQUIRED_IDENTITY_DOCS.includes(d.documentType)
  )
  const selfie = profile.documents.find((d) => d.documentType === 'SELFIE')
  const propertyDocs = profile.documents.filter((d) =>
    PROPERTY_DOC_TYPES.includes(d.documentType)
  )
  const uploadedPropertyDocTypes = propertyDocs.map((d) => d.documentType)
  const missingPropertyDocs = PROPERTY_DOC_TYPES.filter(
    (t) => !uploadedPropertyDocTypes.includes(t)
  ).slice(0, 2) // show up to 2 missing suggestions

  let nextStep = ''
  switch (profile.verificationStatus) {
    case 'PENDING':
      nextStep = 'Upload your identity documents and property proof to begin verification.'
      break
    case 'SUBMITTED':
    case 'UNDER_REVIEW':
      nextStep = 'Your documents are under review. We will notify you within 2 business days.'
      break
    case 'VERIFIED':
      nextStep = 'Your account is verified. You can now go live with your properties.'
      break
    case 'REJECTED':
      nextStep = profile.verificationNotes
        ?? 'Your verification was rejected. Please re-upload corrected documents and resubmit.'
      break
  }

  return {
    verificationStatus: profile.verificationStatus,
    verificationNotes:  profile.verificationNotes,
    verifiedAt:         profile.verifiedAt,
    checklist: {
      identityDocuments: {
        complete:  REQUIRED_IDENTITY_DOCS.every((t) =>
          profile.documents.some((d) => d.documentType === t)
        ),
        documents: identityDocs.map((d) => ({
          type: d.documentType, status: d.status,
        })),
      },
      selfie: {
        complete: !!selfie,
        status:   selfie?.status ?? null,
      },
      propertyDocuments: {
        complete: propertyDocs.length >= REQUIRED_PROPERTY_DOC_MIN,
        documents: propertyDocs.map((d) => ({
          type: d.documentType, status: d.status,
        })),
        missing: missingPropertyDocs,
      },
    },
    nextStep,
  }
}

// ─────────────────────────────────────────────────────────────
// submitVerification — moves status to UNDER_REVIEW
// ─────────────────────────────────────────────────────────────
export async function submitVerificationService(
  ownerId: string,
  dto: SubmitVerificationDto
) {
  const profile = await prisma.ownerProfile.findUnique({
    where: { id: ownerId },
    include: { documents: true },
  })
  if (!profile) throw new NotFoundError('Owner profile not found')

  if (
    profile.verificationStatus === 'UNDER_REVIEW' ||
    profile.verificationStatus === 'VERIFIED'
  ) {
    throw new ConflictError(
      'Verification already submitted or approved.',
      'ALREADY_SUBMITTED'
    )
  }

  // Check required documents are uploaded
  const hasIdentityDocs = REQUIRED_IDENTITY_DOCS.every((t) =>
    profile.documents.some((d) => d.documentType === t)
  )
  const hasSelfie = profile.documents.some((d) => d.documentType === 'SELFIE')
  const hasPropertyDoc = profile.documents.some((d) =>
    PROPERTY_DOC_TYPES.includes(d.documentType)
  )

  if (!hasIdentityDocs || !hasSelfie || !hasPropertyDoc) {
    throw new BadRequestError(
      'Please upload all required documents before submitting: ' +
      'Aadhaar front + back, a selfie, and at least one property document.',
      'MISSING_DOCUMENTS'
    )
  }

  await prisma.ownerProfile.update({
    where: { id: ownerId },
    data: {
      verificationStatus: 'UNDER_REVIEW',
      panNumber:          dto.panNumber,
      aadhaarNumber:      dto.aadhaarNumber,
    },
  })

  // TODO: send email notification to super admin
  return { verificationStatus: 'UNDER_REVIEW' }
}

// ─────────────────────────────────────────────────────────────
// getOwnerDocuments
// ─────────────────────────────────────────────────────────────
export async function getOwnerDocumentsService(ownerId: string) {
  const documents = await prisma.ownerDocument.findMany({
    where: { ownerId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, documentType: true, fileName: true,
      status: true, reviewNotes: true, reviewedAt: true, createdAt: true,
    },
  })
  return { documents }
}
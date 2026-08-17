import { prisma } from '@config/prisma'
import { NotFoundError } from '@utils/errors'
import { UserRole } from '@prisma/client'
import {
  UpdateOwnerProfileDto,
  UpdateTenantProfileDto,
  UpdatePreferencesDto,
} from './users.validation'

export function computeProfileCompletion(
  profile: {
    fullName?: string | null
    phone?: string | null
    dateOfBirth?: Date | null
    gender?: string | null
    profession?: string | null
    emergencyName?: string | null
    emergencyPhone?: string | null
    isIdVerified?: boolean
  },
  preferences?: {
    smoking?: string | null
    foodPreference?: string | null
    compatibilityBio?: string | null
  } | null
): number {
  const checks = [
    !!profile.fullName,
    !!profile.phone,
    !!profile.dateOfBirth,
    !!profile.gender,
    !!profile.profession,
    !!profile.emergencyName,
    !!profile.emergencyPhone,
    !!profile.isIdVerified,
    !!preferences?.smoking,
    !!preferences?.foodPreference,
    !!preferences?.compatibilityBio,
  ]

  const filled = checks.filter(Boolean).length
  return Math.round((filled / checks.length) * 100)
}

export async function getFullProfileService(userId: string, role: UserRole) {
  const user = await prisma.user.findFirst({
    where: { id: userId, isActive: true, deletedAt: null },
    select: {
      id: true,
      email: true,
      role: true,
      // Owners store their number on User (OwnerProfile has no phone column),
      // so the settings form cannot prefill it without this.
      phone: true,
      isEmailVerified: true,
      isPhoneVerified: true,
    },
  })

  if (!user) throw new NotFoundError('User not found')

  if (role === UserRole.OWNER) {
    const ownerProfile = await prisma.ownerProfile.findUnique({
      where: { userId },
      include: {
        documents: {
          select: {
            documentType: true,
            status: true,
            reviewNotes: true,
            createdAt: true,
          },
        },
      },
    })

    return {
      user,
      ownerProfile: ownerProfile
        ? {
            ...ownerProfile,
            panNumber: ownerProfile.panNumber
              ? 'XXXXX' + ownerProfile.panNumber.slice(-5)
              : null,
            aadhaarNumber: ownerProfile.aadhaarNumber
              ? 'XXXX XXXX ' + ownerProfile.aadhaarNumber.slice(-4)
              : null,
          }
        : null,
    }
  }

  if (role === UserRole.TENANT) {
    const tenantProfile = await prisma.tenantProfile.findUnique({
      where: { userId },
      include: {
        preferences: true,
        // Needed to tell "not uploaded" from "uploaded, awaiting review" from
        // "rejected" on the settings page. reviewNotes carries the admin's
        // reason — without it a rejected tenant is told no as a bare fact and
        // has nothing to act on. Same shape as the owner branch — no file keys.
        documents: {
          select: { documentType: true, status: true, reviewNotes: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    return {
      user,
      tenantProfile: tenantProfile
        ? {
            ...tenantProfile,
            aadhaarNumber: tenantProfile.aadhaarNumber
              ? 'XXXX XXXX ' + tenantProfile.aadhaarNumber.slice(-4)
              : null,
          }
        : null,
      preferences: tenantProfile?.preferences ?? null,
    }
  }

  return { user }
}

export async function updateOwnerProfileService(
  userId: string,
  dto: UpdateOwnerProfileDto
) {
  const profile = await prisma.ownerProfile.findUnique({
    where: { userId },
  })

  if (!profile) throw new NotFoundError('Owner profile not found')

  // Phone lives on User, not OwnerProfile — there is no phone column here.
  // It used to be destructured out and silently dropped, so an owner could
  // save their number and it would never persist.
  const { phone, ...ownerProfileData } = dto

  await prisma.$transaction([
    prisma.ownerProfile.update({
      where: { userId },
      data: ownerProfileData,
    }),
    ...(phone !== undefined
      ? [prisma.user.update({ where: { id: userId }, data: { phone } })]
      : []),
  ])

  return { updated: true }
}

export async function updateTenantProfileService(
  userId: string,
  dto: UpdateTenantProfileDto
) {
  const profile = await prisma.tenantProfile.findUnique({
    where: { userId },
    include: { preferences: true },
  })

  if (!profile) throw new NotFoundError('Tenant profile not found')

  const { dateOfBirth, ...rest } = dto

  await prisma.tenantProfile.update({
    where: { userId },
    data: {
      ...rest,
      ...(dateOfBirth ? { dateOfBirth: new Date(dateOfBirth) } : {}),
    },
  })

  const updated = await prisma.tenantProfile.findUnique({
    where: { userId },
    include: { preferences: true },
  })

  const completion = computeProfileCompletion(updated!, updated!.preferences)

  await prisma.tenantProfile.update({
    where: { userId },
    data: { profileCompletion: completion },
  })

  return { profileCompletion: completion }
}

export async function updatePreferencesService(
  userId: string,
  dto: UpdatePreferencesDto
) {
  const tenant = await prisma.tenantProfile.findUnique({
    where: { userId },
    include: { preferences: true },
  })

  if (!tenant) throw new NotFoundError('Tenant profile not found')

  await prisma.tenantPreferences.upsert({
    where: { tenantId: tenant.id },
    update: dto,
    create: { tenantId: tenant.id, ...dto },
  })

  const prefs = await prisma.tenantPreferences.findUnique({
    where: { tenantId: tenant.id },
  })

  const completion = computeProfileCompletion(tenant, prefs)

  await prisma.tenantProfile.update({
    where: { id: tenant.id },
    data: { profileCompletion: completion },
  })

  return { profileCompletion: completion }
}
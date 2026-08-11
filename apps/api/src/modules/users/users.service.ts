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
      include: { preferences: true },
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

  const { phone, ...ownerProfileData } = dto

  await prisma.ownerProfile.update({
    where: { userId },
    data: ownerProfileData,
  })

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
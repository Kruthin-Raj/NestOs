import { prisma } from '@config/prisma'
import { env } from '@config/env'
import { logger } from '@utils/logger'
import { sendOtpEmail } from './auth.mailer'
import {
  generateOtp, hashOtp, verifyOtp,
  getOtpExpiry, maskEmail
} from '@utils/otp.util'
import {
  signAccessToken, signRefreshToken,
  verifyRefreshToken
} from '@utils/jwt.util'
import {
  BadRequestError, UnauthorizedError,
  NotFoundError, ConflictError
} from '@utils/errors'
import { SendOtpDto, VerifyOtpDto } from './auth.validation'
import { UserRole } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────────────────────────
// sendOtp — generates, hashes, stores, and sends an OTP
// ─────────────────────────────────────────────────────────────
export async function sendOtpService(dto: SendOtpDto) {
  console.log('=== SEND OTP SERVICE CALLED ===');
  console.log('DTO:', dto);

  const { email, role } = dto;

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (existingUser && role && existingUser.role !== role) {
    throw new ConflictError(
      `An account with this email already exists as ${existingUser.role.toLowerCase()}.`,
      'ROLE_MISMATCH'
    );
  }

  await prisma.otpCode.updateMany({
    where: { identifier: email, usedAt: null },
    data: { usedAt: new Date() },
  });

  const otp = generateOtp();
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('env.isDevelopment:', env.isDevelopment);

  const codeHash = await hashOtp(otp);
  const expiresAt = getOtpExpiry(env.OTP_EXPIRY_MINUTES);

  await prisma.otpCode.create({
    data: { identifier: email, codeHash, expiresAt },
  });

  try {
  await sendOtpEmail(email, otp)

  // 👇 ALWAYS log in development
  if (env.isDevelopment) {
    console.log(`🔥 DEV OTP for ${email}: ${otp}`)
  }

} catch (error) {
  logger.error('Failed to send OTP email', 'AuthService', error)

  // 👇 FALLBACK — still show OTP in terminal
  if (env.isDevelopment) {
    console.log(`🔥 EMAIL FAILED — OTP for ${email}: ${otp}`)
  }

  throw new BadRequestError(
    'Failed to send OTP email. Please try again.',
    'EMAIL_SEND_FAILED'
  )
}

  return {
    identifier: email,
    expiresInSeconds: env.OTP_EXPIRY_MINUTES * 60,
    maskedEmail: maskEmail(email),
  };
}

// ─────────────────────────────────────────────────────────────
// verifyOtp — verifies OTP, creates user if new, issues tokens
// ─────────────────────────────────────────────────────────────
export async function verifyOtpService(dto: VerifyOtpDto) {
  const { email, otp, role } = dto

  // Find the most recent active OTP
  const otpRecord = await prisma.otpCode.findFirst({
    where: {
      identifier: email,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  if (!otpRecord) {
    throw new UnauthorizedError(
      'No active OTP found. Please request a new one.',
      'OTP_NOT_FOUND'
    )
  }

  // Check attempt count
  if (otpRecord.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new UnauthorizedError(
      'Maximum attempts exceeded. Please request a new OTP.',
      'OTP_MAX_ATTEMPTS'
    )
  }

  // Increment attempt count before verifying
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { attempts: { increment: 1 } },
  })

  // Verify the OTP
  const isValid = await verifyOtp(otp, otpRecord.codeHash)
  if (!isValid) {
    const remaining = env.OTP_MAX_ATTEMPTS - (otpRecord.attempts + 1)
    throw new UnauthorizedError(
      `Invalid OTP. ${remaining} attempt(s) remaining.`,
      'INVALID_OTP'
    )
  }

  // Mark OTP as used
  await prisma.otpCode.update({
    where: { id: otpRecord.id },
    data: { usedAt: new Date() },
  })

  // Get or create the user
  let user = await prisma.user.findUnique({ where: { email } })
  let isNewUser = false

  if (!user) {
    if (!role) {
      throw new BadRequestError(
        'Role is required for first-time signup.',
        'ROLE_REQUIRED'
      )
    }

    // Create user and their profile in a transaction
    user = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          role: role as UserRole,
          isEmailVerified: true,
        },
      })

      // Create role-specific profile
      if (role === 'OWNER') {
        await tx.ownerProfile.create({
          data: {
            userId: newUser.id,
            fullName: '',  // filled during onboarding
          },
        })
      } else if (role === 'TENANT') {
        await tx.tenantProfile.create({
          data: {
            userId: newUser.id,
            fullName: '',  // filled during onboarding
          },
        })
      }

      return newUser
    })

    isNewUser = true
  } else {
    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date(), isEmailVerified: true },
    })
  }

  // Create refresh token
  const tokenId = uuidv4()
  const tokenHash = await bcrypt.hash(tokenId, 10)
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.refreshToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: refreshExpiresAt,
    },
  })

  // Sign tokens
  const accessToken = signAccessToken({
    userId: user.id,
    role: user.role,
    email: user.email,
  })

  const refreshToken = signRefreshToken({
    userId: user.id,
    tokenId,
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isNewUser,
    },
    accessToken,
    refreshToken,
    expiresIn: 900,
  }
}

// ─────────────────────────────────────────────────────────────
// getCurrentUser — returns user with profile for /auth/me
// ─────────────────────────────────────────────────────────────
export async function getCurrentUserService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true, deletedAt: null },
    include: {
      ownerProfile: {
        select: {
          id: true,
          fullName: true,
          businessName: true,
          verificationStatus: true,
        },
      },
      tenantProfile: {
        select: {
          id: true,
          fullName: true,
          status: true,
          profileCompletion: true,
        },
      },
    },
  })

  if (!user) throw new NotFoundError('User not found')
  return user
}
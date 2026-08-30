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
  NotFoundError, ConflictError, ForbiddenError
} from '@utils/errors'
import {
  SendOtpDto, VerifyOtpDto, SignupDto, LoginDto,
  ForgotPasswordDto, ResetPasswordDto,
} from './auth.validation'
import { UserRole } from '@prisma/client'
import { v4 as uuidv4 } from 'uuid'
import bcrypt from 'bcryptjs'

// ─────────────────────────────────────────────────────────────
// sendOtp — generates, hashes, stores, and sends an OTP
// ─────────────────────────────────────────────────────────────
/**
 * Generates a one-time code, stores its hash and emails it.
 *
 * Any previously issued code for the address is retired first, so only the most
 * recent one can be used.
 */
async function issueOtp(email: string): Promise<void> {
  await prisma.otpCode.updateMany({
    where: { identifier: email, usedAt: null },
    data:  { usedAt: new Date() },
  })

  const code      = generateOtp()
  const codeHash  = await hashOtp(code)
  const expiresAt = getOtpExpiry(env.OTP_EXPIRY_MINUTES)

  await prisma.otpCode.create({ data: { identifier: email, codeHash, expiresAt } })

  try {
    await sendOtpEmail(email, code)
    if (env.isDevelopment) {
      console.log(`🔥 DEV OTP for ${email}: ${code}`)
    }
  } catch (error) {
    logger.error('Failed to send OTP email', 'AuthService', error)

    // Still surfaced locally so development is not blocked by SMTP.
    if (env.isDevelopment) {
      console.log(`🔥 EMAIL FAILED — DEV OTP for ${email}: ${code}`)
      return
    }

    throw new BadRequestError(
      'Failed to send OTP email. Please try again.',
      'EMAIL_SEND_FAILED'
    )
  }
}

/** Verifies a code and marks it used. Throws if it is wrong, stale or exhausted. */
async function consumeOtp(email: string, code: string): Promise<void> {
  const record = await prisma.otpCode.findFirst({
    where:   { identifier: email, usedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  })

  if (!record) {
    throw new UnauthorizedError(
      'No active OTP found. Please request a new one.',
      'OTP_NOT_FOUND'
    )
  }

  if (record.attempts >= env.OTP_MAX_ATTEMPTS) {
    throw new UnauthorizedError(
      'Maximum attempts exceeded. Please request a new OTP.',
      'OTP_MAX_ATTEMPTS'
    )
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data:  { attempts: { increment: 1 } },
  })

  if (!(await verifyOtp(code, record.codeHash))) {
    const remaining = env.OTP_MAX_ATTEMPTS - (record.attempts + 1)
    throw new UnauthorizedError(
      `Invalid OTP. ${remaining} attempt(s) remaining.`,
      'INVALID_OTP'
    )
  }

  await prisma.otpCode.update({
    where: { id: record.id },
    data:  { usedAt: new Date() },
  })
}

/**
 * Resends the signup code. Only ever used for an account that already exists
 * but has not confirmed its address — accounts are created by signupService.
 */
export async function sendOtpService(dto: SendOtpDto) {
  const { email, role } = dto

  const existingUser = await prisma.user.findUnique({
    where:  { email },
    select: { id: true, role: true },
  })

  if (existingUser && role && existingUser.role !== role) {
    throw new ConflictError(
      `An account with this email already exists as ${existingUser.role.toLowerCase()}.`,
      'ROLE_MISMATCH'
    )
  }

  await issueOtp(email)

  return {
    identifier:       email,
    expiresInSeconds: env.OTP_EXPIRY_MINUTES * 60,
    maskedEmail:      maskEmail(email),
  }
}

/**
 * Confirms the address after signup and starts a session.
 *
 * This no longer creates accounts: signup does that, with a password. A code
 * for an address with no account is treated as invalid.
 */
export async function verifyOtpService(dto: VerifyOtpDto) {
  const { email, otp: code } = dto

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
    throw new UnauthorizedError(
      'No account found for this email. Please sign up first.',
      'ACCOUNT_NOT_FOUND'
    )
  }

  await consumeOtp(email, code)

  const wasUnverified = !user.isEmailVerified

  await prisma.user.update({
    where: { id: user.id },
    data:  { isEmailVerified: true, lastLoginAt: new Date() },
  })

  const session = await issueSession({ ...user, isEmailVerified: true })

  return { ...session, user: { ...session.user, isNewUser: wasUnverified } }
}

// ─────────────────────────────────────────────────────────────
// getCurrentUser — returns user with profile for /auth/me
// ─────────────────────────────────────────────────────────────
export async function getCurrentUserService(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId, status: 'ACTIVE', deletedAt: null },
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
// ─────────────────────────────────────────────────────────────
// refreshTokens — rotates the refresh token and issues a new access token
//
// Storage note: verifyOtpService stores bcrypt(tokenId) in
// refresh_tokens.tokenHash, and the JWT carries the plaintext tokenId. bcrypt
// salts per hash, so the row cannot be looked up by hash — we load the user's
// live tokens and compare. A user has at most a handful, and expired/revoked
// rows are filtered out in SQL first.
//
// Rotation is single-use: the presented token is revoked as it is exchanged, so
// a captured refresh token stops working the moment the real client refreshes.
// ─────────────────────────────────────────────────────────────
export async function refreshTokensService(refreshTokenCookie: string | undefined) {
  if (!refreshTokenCookie) {
    throw new UnauthorizedError('No refresh token provided. Please log in.', 'NO_REFRESH_TOKEN')
  }

  // Throws UnauthorizedError on an expired or tampered token.
  const payload = verifyRefreshToken(refreshTokenCookie)

  const candidates = await prisma.refreshToken.findMany({
    where: {
      userId:    payload.userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: 'desc' },
  })

  let matched: (typeof candidates)[number] | undefined
  for (const row of candidates) {
    if (await bcrypt.compare(payload.tokenId, row.tokenHash)) {
      matched = row
      break
    }
  }

  if (!matched) {
    // Valid signature but no live row: already rotated, revoked by logout, or
    // replayed. Treat as a dead session rather than issuing new tokens.
    throw new UnauthorizedError('Session expired. Please log in again.', 'REFRESH_TOKEN_REVOKED')
  }

  const user = await prisma.user.findUnique({
    where:  { id: payload.userId, status: 'ACTIVE', deletedAt: null },
    select: { id: true, email: true, role: true, isEmailVerified: true, tokenVersion: true },
  })

  if (!user) {
    await prisma.refreshToken.update({
      where: { id: matched.id },
      data:  { revokedAt: new Date() },
    })
    throw new UnauthorizedError('Account is no longer active.', 'ACCOUNT_INACTIVE')
  }

  const newTokenId   = uuidv4()
  const newTokenHash = await bcrypt.hash(newTokenId, 10)
  const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  // Revoke the presented token and issue its replacement atomically, so a
  // failure cannot leave the caller with two live tokens or none.
  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: matched.id },
      data:  { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: newTokenHash, expiresAt: refreshExpiresAt },
    }),
  ])

  const accessToken = signAccessToken({
    userId:       user.id,
    role:         user.role,
    email:        user.email,
    tokenVersion: user.tokenVersion,
  })

  const refreshToken = signRefreshToken({ userId: user.id, tokenId: newTokenId })

  return {
    user: {
      id:              user.id,
      email:           user.email,
      role:            user.role,
      isEmailVerified: user.isEmailVerified,
    },
    accessToken,
    refreshToken,
    expiresIn: 900,
  }
}

// ─────────────────────────────────────────────────────────────
// logout — revokes the refresh token server-side.
//
// Clearing the cookie alone left the token valid for its full 7 days, so a
// copy taken before logout still worked. Best-effort by design: a malformed or
// already-revoked token must not stop the user from logging out.
// ─────────────────────────────────────────────────────────────
export async function logoutService(refreshTokenCookie: string | undefined): Promise<void> {
  if (!refreshTokenCookie) return

  try {
    const payload = verifyRefreshToken(refreshTokenCookie)

    const candidates = await prisma.refreshToken.findMany({
      where: { userId: payload.userId, revokedAt: null },
    })

    for (const row of candidates) {
      if (await bcrypt.compare(payload.tokenId, row.tokenHash)) {
        await prisma.refreshToken.update({
          where: { id: row.id },
          data:  { revokedAt: new Date() },
        })
        break
      }
    }
  } catch (err) {
    logger.warn('Logout could not revoke the refresh token', 'AuthService', err)
  }
}

// ─────────────────────────────────────────────────────────────
// Password authentication
//
// OTP is no longer the way in. It now does two jobs only: proving you own the
// address at signup, and authorising a password reset. Day-to-day login is
// email + password.
// ─────────────────────────────────────────────────────────────

const BCRYPT_ROUNDS = 10

/** Issues an access/refresh pair and records the refresh token. */
async function issueSession(user: {
  id: string
  email: string
  role: UserRole
  isEmailVerified: boolean
  tokenVersion?: number
}) {
  const tokenId   = uuidv4()
  const tokenHash = await bcrypt.hash(tokenId, BCRYPT_ROUNDS)

  await prisma.refreshToken.create({
    data: {
      userId:    user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  })

  return {
    user: {
      id:              user.id,
      email:           user.email,
      role:            user.role,
      isEmailVerified: user.isEmailVerified,
    },
    accessToken:  signAccessToken({ userId: user.id, role: user.role, email: user.email, tokenVersion: user.tokenVersion }),
    refreshToken: signRefreshToken({ userId: user.id, tokenId }),
    expiresIn:    900,
  }
}

/** Creates the account (unverified) and emails an OTP to confirm the address. */
export async function signupService(dto: SignupDto) {
  const { email, password, role } = dto

  const existing = await prisma.user.findUnique({ where: { email } })

  if (existing) {
    // An unverified account can be re-registered — someone who abandoned signup
    // should not be locked out of their own address.
    if (existing.isEmailVerified) {
      throw new ConflictError(
        'An account with this email already exists. Log in instead.',
        'EMAIL_IN_USE'
      )
    }

    await prisma.user.update({
      where: { id: existing.id },
      data:  { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS), role: role as UserRole },
    })
  } else {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)

    await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: { email, role: role as UserRole, passwordHash, isEmailVerified: false },
      })

      if (role === 'OWNER') {
        await tx.ownerProfile.create({ data: { userId: newUser.id, fullName: '' } })
      } else {
        await tx.tenantProfile.create({ data: { userId: newUser.id, fullName: '' } })
      }
    })
  }

  await issueOtp(email)

  return {
    identifier:       email,
    expiresInSeconds: env.OTP_EXPIRY_MINUTES * 60,
    maskedEmail:      maskEmail(email),
  }
}

export async function loginService(dto: LoginDto) {
  const { email, password } = dto

  const user = await prisma.user.findUnique({ where: { email } })

  // Same message whether the address is unknown or the password is wrong, so
  // this cannot be used to discover which accounts exist.
  const invalid = () =>
    new UnauthorizedError('Incorrect email or password.', 'INVALID_CREDENTIALS')

  if (!user || user.deletedAt) throw invalid()

  if (user.status === 'BLOCKED') {
    throw new ForbiddenError('This account has been blocked by an administrator.', 'ACCOUNT_BLOCKED')
  }
  if (user.status === 'SUSPENDED') {
    throw new ForbiddenError('This account is currently suspended.', 'ACCOUNT_SUSPENDED')
  }
  if (user.status === 'DEACTIVATED') {
    throw new ForbiddenError('This account has been deactivated.', 'ACCOUNT_DEACTIVATED')
  }

  // Accounts that predate password login, including the seeded admin.
  if (!user.passwordHash) {
    throw new BadRequestError(
      'This account has no password yet. Use "Forgot password" to set one.',
      'PASSWORD_NOT_SET'
    )
  }

  if (!(await bcrypt.compare(password, user.passwordHash))) throw invalid()

  if (!user.isEmailVerified) {
    throw new BadRequestError(
      'Please verify your email address first. We can send you a new code.',
      'EMAIL_NOT_VERIFIED'
    )
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { lastLoginAt: new Date() },
  })

  return issueSession(user)
}

/**
 * Always reports success. Confirming whether an address is registered would
 * turn this into an account-enumeration oracle.
 */
export async function forgotPasswordService(dto: ForgotPasswordDto) {
  const user = await prisma.user.findUnique({ where: { email: dto.email } })

  if (user && user.status === 'ACTIVE' && !user.deletedAt) {
    try {
      await issueOtp(dto.email)
    } catch (err) {
      // Never surface a send failure here. Throwing would make a registered
      // address answer differently from an unknown one, which is precisely the
      // enumeration oracle this endpoint exists to avoid.
      logger.error('Failed to send password reset email', 'AuthService', err)
    }
  } else {
    logger.warn('Password reset requested for an unknown address', 'AuthService')
  }

  return {
    identifier:       dto.email,
    expiresInSeconds: env.OTP_EXPIRY_MINUTES * 60,
    maskedEmail:      maskEmail(dto.email),
  }
}

export async function resetPasswordService(dto: ResetPasswordDto) {
  const { email, otp: code, password } = dto

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user || user.status !== 'ACTIVE' || user.deletedAt) {
    throw new UnauthorizedError('Invalid or expired code.', 'INVALID_OTP')
  }

  await consumeOtp(email, code)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: user.id },
      data:  {
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
        // Setting a password by email also proves the address.
        isEmailVerified: true,
        lastLoginAt:     new Date(),
      },
    }),
    // Any session opened before the reset is no longer trustworthy.
    prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data:  { revokedAt: new Date() },
    }),
  ])

  return issueSession({ ...user, isEmailVerified: true })
}

import jwt from 'jsonwebtoken'
import { env } from '@config/env'
import { UnauthorizedError } from './errors'

export interface JwtAccessPayload {
  userId: string
  role: 'SUPER_ADMIN' | 'OWNER' | 'TENANT'
  email: string
}

export interface JwtRefreshPayload {
  userId: string
  tokenId: string   // stored refresh token ID (for revocation)
}

// ─────────────────────────────────────────────────────────────
// Sign tokens
// ─────────────────────────────────────────────────────────────
export function signAccessToken(payload: JwtAccessPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
    issuer: 'nestos',
  } as jwt.SignOptions)
}

export function signRefreshToken(payload: JwtRefreshPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    issuer: 'nestos',
  } as jwt.SignOptions)
}

// ─────────────────────────────────────────────────────────────
// Verify tokens — throws UnauthorizedError on failure
// ─────────────────────────────────────────────────────────────
export function verifyAccessToken(token: string): JwtAccessPayload {
  try {
    return jwt.verify(token, env.JWT_ACCESS_SECRET, {
      issuer: 'nestos',
    }) as JwtAccessPayload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Access token expired', 'TOKEN_EXPIRED')
    }
    throw new UnauthorizedError('Invalid access token', 'TOKEN_INVALID')
  }
}

export function verifyRefreshToken(token: string): JwtRefreshPayload {
  try {
    return jwt.verify(token, env.JWT_REFRESH_SECRET, {
      issuer: 'nestos',
    }) as JwtRefreshPayload
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new UnauthorizedError('Refresh token expired. Please log in again.', 'REFRESH_TOKEN_EXPIRED')
    }
    throw new UnauthorizedError('Invalid refresh token', 'REFRESH_TOKEN_INVALID')
  }
}

// ─────────────────────────────────────────────────────────────
// Cookie options — used when setting tokens in responses
// ─────────────────────────────────────────────────────────────
export function getAccessTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: (env.isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
    maxAge: 15 * 60 * 1000,         // 15 minutes in ms
    path: '/',
  }
}

export function getRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: (env.isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
    path: '/api/v1/auth',             // restrict to auth routes only
  }
}

// Clearing a cookie only works when the path matches the one it was set with.
// The access cookie uses '/', so this is correct for it.
export function clearTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: (env.isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
    maxAge: 0,
    path: '/',
  }
}

// The refresh cookie is scoped to '/api/v1/auth' (see
// getRefreshTokenCookieOptions), so clearing it with path '/' silently did
// nothing and the browser kept sending it after logout.
export function clearRefreshTokenCookieOptions() {
  return {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: (env.isProduction ? 'strict' : 'lax') as 'strict' | 'lax',
    maxAge: 0,
    path: '/api/v1/auth',
  }
}
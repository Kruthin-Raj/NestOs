import rateLimit, { ipKeyGenerator } from 'express-rate-limit'
import { RateLimitError } from '@utils/errors'

export const otpRateLimit = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => {
    const email =
      typeof req.body?.email === 'string'
        ? req.body.email.trim().toLowerCase()
        : ''

    return email || ipKeyGenerator(req.ip || '')
  },
  handler: (_req, _res, next) => {
    next(new RateLimitError('Too many OTP requests. Please wait 10 minutes before trying again.'))
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export const generalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
  handler: (_req, _res, next) => {
    next(new RateLimitError())
  },
  standardHeaders: true,
  legacyHeaders: false,
})

export const strictRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  keyGenerator: (req) => ipKeyGenerator(req.ip || ''),
  handler: (_req, _res, next) => {
    next(new RateLimitError('Too many requests. Please slow down.'))
  },
  standardHeaders: true,
  legacyHeaders: false,
})
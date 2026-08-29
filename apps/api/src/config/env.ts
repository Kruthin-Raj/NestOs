import dotenv from 'dotenv'

dotenv.config()

// ─────────────────────────────────────────────────────────────
// Helper: throws a clear error if a required env var is missing
// ─────────────────────────────────────────────────────────────
function requireEnv(key: string): string {
  const value = process.env[key]
  if (!value || value.trim() === '') {
    throw new Error(
      `[Config] Missing required environment variable: ${key}\n` +
      `Check your .env file and make sure ${key} is set.`
    )
  }
  return value.trim()
}

function optionalEnv(key: string, defaultValue: string): string {
  return process.env[key]?.trim() || defaultValue
}

// ─────────────────────────────────────────────────────────────
// Validated config object — import this everywhere
// instead of process.env directly
// ─────────────────────────────────────────────────────────────
export const env = {
  // Server
  NODE_ENV: optionalEnv('NODE_ENV', 'development'),
  PORT: parseInt(optionalEnv('PORT', '4000'), 10),
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV === 'development',

  // Database
  DATABASE_URL: requireEnv('DATABASE_URL'),

  // JWT
  JWT_ACCESS_SECRET: requireEnv('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: requireEnv('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: optionalEnv('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: optionalEnv('JWT_REFRESH_EXPIRES_IN', '7d'),

  // OTP
  OTP_EXPIRY_MINUTES: parseInt(optionalEnv('OTP_EXPIRY_MINUTES', '10'), 10),
  OTP_MAX_ATTEMPTS: parseInt(optionalEnv('OTP_MAX_ATTEMPTS', '3'), 10),

  // Email (SMTP via nodemailer — see config/mail.ts)
  EMAIL_HOST:     requireEnv('EMAIL_HOST'),
  EMAIL_PORT:     parseInt(optionalEnv('EMAIL_PORT', '587'), 10),
  EMAIL_SECURE:   optionalEnv('EMAIL_SECURE', 'false'),
  EMAIL_USER:     requireEnv('EMAIL_USER'),
  EMAIL_PASSWORD: requireEnv('EMAIL_PASSWORD'),
  // Required on purpose: this address is what users see as the sender, so a
  // silent fallback to somebody's personal inbox is worse than failing to boot.
  EMAIL_FROM:     requireEnv('EMAIL_FROM'),

  // Razorpay — REMOVED (using direct UPI payments now)

  // File Storage — local disk (uploads/ directory)
  UPLOAD_DIR: optionalEnv('UPLOAD_DIR', 'uploads'),

  // Business Rules
  REJECTION_FLAG_THRESHOLD: parseInt(optionalEnv('REJECTION_FLAG_THRESHOLD', '3'), 10),

  // CORS
  FRONTEND_URL: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
} as const


// Log config summary on startup (without secrets)
export function logConfig(): void {
  console.log('[Config] Environment loaded:')
  console.log(`  NODE_ENV:      ${env.NODE_ENV}`)
  console.log(`  PORT:          ${env.PORT}`)
  console.log(`  DATABASE_URL:  ${env.DATABASE_URL.replace(/:\/\/.*@/, '://***@')}`)
  console.log(`  FRONTEND_URL:  ${env.FRONTEND_URL}`)
}
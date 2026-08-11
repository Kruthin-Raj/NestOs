import { env } from '@config/env'

// ─────────────────────────────────────────────────────────────
// Log levels
// ─────────────────────────────────────────────────────────────
type LogLevel = 'info' | 'warn' | 'error' | 'debug'

interface LogEntry {
  level: LogLevel
  message: string
  timestamp: string
  context?: string
  data?: unknown
  error?: {
    message: string
    stack?: string
  }
}

// ─────────────────────────────────────────────────────────────
// Core logger function
// In development: pretty-print with colors
// In production: output JSON (for log aggregation tools)
// ─────────────────────────────────────────────────────────────
function log(level: LogLevel, message: string, context?: string, data?: unknown): void {
  const entry: LogEntry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    context,
    data,
  }

  if (env.isProduction) {
    // JSON output for production log aggregators (Datadog, Logtail, etc.)
    console.log(JSON.stringify(entry))
    return
  }

  // Pretty output for development
  const COLORS: Record<LogLevel, string> = {
    info:  '\x1b[36m',  // cyan
    warn:  '\x1b[33m',  // yellow
    error: '\x1b[31m',  // red
    debug: '\x1b[35m',  // magenta
  }
  const RESET = '\x1b[0m'
  const time = new Date().toLocaleTimeString('en-IN')
  const ctx = context ? ` [${context}]` : ''
  const dataStr = data ? `\n  ${JSON.stringify(data, null, 2)}` : ''

  console.log(
    `${COLORS[level]}[${level.toUpperCase()}]${RESET} ${time}${ctx} — ${message}${dataStr}`
  )
}

// ─────────────────────────────────────────────────────────────
// Public logger API
// ─────────────────────────────────────────────────────────────
export const logger = {
  info:  (message: string, context?: string, data?: unknown) =>
    log('info', message, context, data),

  warn:  (message: string, context?: string, data?: unknown) =>
    log('warn', message, context, data),

  error: (message: string, context?: string, error?: unknown) => {
    const errData = error instanceof Error
      ? { message: error.message, stack: env.isDevelopment ? error.stack : undefined }
      : error
    log('error', message, context, errData)
  },

  debug: (message: string, context?: string, data?: unknown) => {
    if (env.isDevelopment) {
      log('debug', message, context, data)
    }
  },

  // Log an incoming HTTP request — used by Morgan middleware
  http: (method: string, url: string, status: number, durationMs: number) => {
    const level: LogLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
    log(level, `${method} ${url} → ${status} (${durationMs}ms)`, 'HTTP')
  },
}
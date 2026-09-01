import { createApp } from './app'
import { env, logConfig } from '@config/env'
import { prisma, disconnectPrisma } from '@config/prisma'
import { logger } from '@utils/logger'
import { initIssueSlaCron } from './cron/issue-sla.cron'

async function main(): Promise<void> {
  // ── 1. Validate environment ──────────────────────────────
  // env.ts throws immediately if any required variable is missing
  logConfig()

  // ── 2. Test database connection ──────────────────────────
  try {
    await prisma.$connect()
    logger.info('Connected to database', 'Database')
  } catch (err) {
    logger.error('Failed to connect to database', 'Database', err)
    logger.error('Check your DATABASE_URL in .env and make sure PostgreSQL is running.')
    process.exit(1)  // exit immediately — no point starting without a DB
  }

  // ── 3. Create and start Express app ──────────────────────
  const app = createApp()

  const server = app.listen(env.PORT, () => {
    logger.info(`NestOS API running on http://localhost:${env.PORT}`, 'Server')
    logger.info(`Health check: http://localhost:${env.PORT}/health`, 'Server')
    logger.info(`Environment: ${env.NODE_ENV}`, 'Server')
  })

  // ── 3.5 Initialize Background Jobs ───────────────────────
  initIssueSlaCron()

  // ── 4. Graceful shutdown handlers ────────────────────────
  // These ensure in-flight requests finish before the server stops.
  // Critical on Railway/Render where the server is restarted on deploy.
  async function gracefulShutdown(signal: string): Promise<void> {
    logger.info(`Received ${signal}. Shutting down gracefully...`, 'Server')

    server.close(async () => {
      logger.info('HTTP server closed', 'Server')
      await disconnectPrisma()
      logger.info('Shutdown complete', 'Server')
      process.exit(0)
    })

    // Force shutdown after 10 seconds if graceful shutdown hangs
    setTimeout(() => {
      logger.error('Forced shutdown after timeout', 'Server')
      process.exit(1)
    }, 10_000)
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT',  () => gracefulShutdown('SIGINT'))

  // ── 5. Unhandled promise rejections ──────────────────────
  process.on('unhandledRejection', (reason: unknown) => {
    logger.error('Unhandled promise rejection', 'Process', reason)
    // In production, crash and let the process manager restart
    if (env.isProduction) {
      process.exit(1)
    }
  })
}

main().catch((err) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
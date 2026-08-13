import express, { Application } from 'express'
import path from 'path'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import cookieParser from 'cookie-parser'

import { env } from '@config/env'
import { logger } from '@utils/logger'
import { globalErrorHandler, notFoundHandler } from '@middleware/error.middleware'
import { generalRateLimit } from '@middleware/rate-limit.middleware'

// ── Module routers (imported here as they are built in Phase 8)
import { authRouter } from '@modules/auth/auth.routes'
import { usersRouter } from '@modules/users/users.routes'
import { uploadsRouter } from '@modules/uploads/uploads.routes'
import { ownerVerificationRouter } from '@modules/owner-verification/owner-verification.routes'
import { buildingsRouter, publicBuildingsRouter } from '@modules/buildings/buildings.routes'
import { floorsRouter } from '@modules/floors/floors.routes'
import { roomsRouter } from '@modules/rooms/rooms.routes'
import { bedsRouter } from '@modules/beds/beds.routes'
import { tenantsRouter } from '@modules/tenants/tenants.routes'
import { bookingsRouter } from '@modules/bookings/bookings.routes'
import { paymentsRouter } from '@modules/payments/payments.routes'
import { issuesRouter } from '@modules/issues/issues.routes'
import { ownerNoticesRouter, tenantNoticesRouter } from '@modules/notices/notices.routes'
import { dashboardRouter } from '@modules/dashboard/dashboard.routes'
import { adminRouter } from '@modules/admin/admin.routes'

export function createApp(): Application {
  const app = express()

  // ── Security middleware ──────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))

  // ── CORS ─────────────────────────────────────────────────
  app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,       // required for cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  // ── Body parsers ─────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Serve uploaded files statically ─────────────────────
  app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)))

  // ── Cookie parser ─────────────────────────────────────────
  app.use(cookieParser())

  // ── HTTP request logging (Morgan) ─────────────────────────
  // In development: use concise "dev" format in terminal
  // In production: use combined format for log files
  if (env.isDevelopment) {
    app.use(morgan('dev'))
  } else {
    app.use(morgan('combined', {
      stream: { write: (msg) => logger.info(msg.trim(), 'HTTP') },
    }))
  }

  // ── Global rate limiting ──────────────────────────────────
  app.use('/api', generalRateLimit)

  // ── Health check (no auth, no rate limit) ─────────────────
  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'nestos-api',
      timestamp: new Date().toISOString(),
      environment: env.NODE_ENV,
    })
  })

  // ── API Routes ────────────────────────────────────────────
  const API_PREFIX = '/api/v1'

  app.use(`${API_PREFIX}/auth`,              authRouter)
  app.use(`${API_PREFIX}/users`,             usersRouter)
  app.use(`${API_PREFIX}/uploads`,           uploadsRouter)
  app.use(`${API_PREFIX}/owner/verification`,ownerVerificationRouter)
  // Public building routes MUST be mounted before buildingsRouter: the latter
  // guards everything with requireVerifiedOwner and defines '/:buildingId',
  // which would otherwise match '/search' first.
  app.use(`${API_PREFIX}/buildings`,         publicBuildingsRouter)
  app.use(`${API_PREFIX}/buildings`,         buildingsRouter)
  app.use(`${API_PREFIX}/buildings`,         floorsRouter)   // /buildings/:id/floors
  app.use(`${API_PREFIX}/buildings`,         roomsRouter)    // /buildings/:id/rooms
  app.use(`${API_PREFIX}/buildings`,         bedsRouter)     // /buildings/:id/rooms/:id/beds
  app.use(`${API_PREFIX}/owner`,             tenantsRouter)  // /owner/tenants
  app.use(`${API_PREFIX}/bookings`,          bookingsRouter)
  app.use(`${API_PREFIX}/payments`,          paymentsRouter)
  app.use(`${API_PREFIX}/issues`,            issuesRouter)
  app.use(`${API_PREFIX}/owner/notices`,     ownerNoticesRouter)
  app.use(`${API_PREFIX}/tenant/notices`,    tenantNoticesRouter)
  app.use(`${API_PREFIX}/owner/dashboard`,   dashboardRouter)
  app.use(`${API_PREFIX}/tenant/dashboard`,  dashboardRouter)
  app.use(`${API_PREFIX}/admin`,             adminRouter)

  // ── 404 and global error handler ─────────────────────────
  // These MUST be registered after all routes
  app.use(notFoundHandler)
  app.use(globalErrorHandler)

  return app
}
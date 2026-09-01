import express, { Application } from 'express'
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
import { ownerVisitsRouter, tenantVisitsRouter } from '@modules/visits/visits.routes'
import { dashboardRouter } from '@modules/dashboard/dashboard.routes'
import { adminRouter } from '@modules/admin/admin.routes'
import { reportsRouter } from '@modules/reports/reports.routes'

export function createApp(): Application {
  const app = express()

  // ── Security middleware ──────────────────────────────────
  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }))

  const allowedOrigins = [
    env.FRONTEND_URL,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:3001',
    'http://127.0.0.1:5173',
    ...(env.CORS_ORIGIN ? env.CORS_ORIGIN.split(',').map(o => o.trim()) : [])
  ].filter(Boolean)

  app.use(cors({
    origin: (origin, callback) => {
      // No Origin header at all: curl, server-to-server, same-origin requests.
      if (!origin) return callback(null, true)

      if (allowedOrigins.includes(origin)) return callback(null, true)

      // Anything goes locally, so a teammate on a different port is not blocked.
      // This MUST stay gated on the environment: both branches used to return
      // true unconditionally, which combined with credentials: true reflected
      // every origin in production as well.
      if (env.isDevelopment) return callback(null, true)

      return callback(new Error('Not allowed by CORS'))
    },
    credentials: true,       // required for cookies to be sent cross-origin
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }))

  // ── Body parsers ─────────────────────────────────────────
  app.use(express.json({ limit: '10mb' }))
  app.use(express.urlencoded({ extended: true }))

  // ── Uploaded files are NOT served statically ─────────────
  // They are Aadhaar/PAN/selfie documents. This used to be
  //   app.use('/uploads', express.static(path.resolve(env.UPLOAD_DIR)))
  // which exposed every document to anyone who guessed a filename, with no
  // authentication whatsoever. Reads now go through
  // GET /api/v1/uploads/documents/:documentId, which checks that the caller
  // owns the document (or is an admin reviewing verification).
  // Do not reintroduce a static mount here.

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
  app.use(`${API_PREFIX}/owner/visits`,      ownerVisitsRouter)
  app.use(`${API_PREFIX}/tenant/visits`,     tenantVisitsRouter)
  app.use(`${API_PREFIX}/owner/dashboard`,   dashboardRouter)
  app.use(`${API_PREFIX}/tenant/dashboard`,  dashboardRouter)
  app.use(`${API_PREFIX}/admin`,             adminRouter)
  app.use(`${API_PREFIX}/reports`,           reportsRouter)

  // ── 404 and global error handler ─────────────────────────
  // These MUST be registered after all routes
  app.use(notFoundHandler)
  app.use(globalErrorHandler)

  return app
}
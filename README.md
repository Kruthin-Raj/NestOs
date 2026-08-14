# NestOS — PG & Hostel Management System

NestOS is a platform for managing PGs, hostels, and shared accommodations, for both
property owners and tenants.

> **New to this repo?** Read [Architecture](#architecture), [Repo structure](#repo-structure)
> and [Conventions](#conventions) before writing code. If you last saw this repo when it was
> a Next.js app, read [What changed in the cleanup](#what-changed-in-the-cleanup) — files moved.

## Tech Stack

- **Frontend**: React 19 + Vite, React Router 7, Tailwind CSS v4, TanStack Query,
  Zustand, react-hook-form + Zod, Leaflet (maps), Recharts
- **Backend**: Node.js, Express 5, Prisma 7 ORM, Zod validation, JWT in httpOnly cookies
- **Database**: PostgreSQL (hosted on Supabase)
- **Payments**: Direct UPI Intent (zero fee) — see [How payments work](#how-payments-work)
- **File Storage**: Local disk — upload endpoints are **not implemented yet** and
  return `501 Not Implemented`

> The frontend is a **Vite SPA, not Next.js.** It was migrated off Next.js. There is no
> SSR, no server components, and no `app/` router. `'use client'` does nothing here.

---

## Architecture

Two independent apps in `apps/`. There is no shared package and no monorepo workspace —
each app installs and runs on its own. The only contract between them is HTTP.

```
apps/web  (Vite SPA, port 3000)
    |
    |  axios, withCredentials: true
    |  baseURL = VITE_API_URL  (default http://localhost:4000/api/v1)
    v
apps/api  (Express, port 4000)
    |
    |  Prisma 7
    v
PostgreSQL (Supabase)
```

**Auth is cookie-based.** Login sets two httpOnly cookies (`nestos_token`,
`nestos_refresh`). The browser sends them automatically because axios sets
`withCredentials: true` and the API sets `cors({ credentials: true })`.

This is why `FRONTEND_URL` in `apps/api/.env` **must exactly match** the origin the web
app runs on. A mismatch means the browser drops every request, which looks like a broken
login rather than a CORS problem.

**Every API response uses the same envelope**, built by `src/utils/response.util.ts`:

```jsonc
// success
{ "success": true,  "message": "Buildings fetched", "data": { ... } }
// error — thrown as an AppError subclass, formatted by error.middleware.ts
{ "success": false, "message": "Building not found", "error": { "code": "NOT_FOUND" } }
```

The web side re-declares these types by hand in `apps/web/src/types/index.ts`. **The two
sides can drift** — if you change an API response shape, update that file too. (A shared
types package would fix this properly; see [Known issues](#known-issues).)

---

## Repo structure

```
apps/api/src/
  config/          env, prisma client, mail, app-wide constants
  middleware/      auth, rbac, validate, error handler, rate limits
  modules/<domain>/
    <domain>.routes.ts       HTTP layer: paths, middleware, request -> service -> response
    <domain>.service.ts      all business logic and Prisma access
    <domain>.validation.ts   Zod schemas (only where they are big enough to split out)
  types/           express.d.ts globally adds `user` and `resourceOwnerId` to Request
  utils/           errors, jwt, logger, otp, pagination, response, asyncHandler

apps/web/src/
  pages/           one file per screen, named after the screen (owner/, tenant/, auth/)
  layouts/         the four shells: Marketing, Auth, Owner, Tenant
  components/      ui/ (primitives), shared/, feedback/, layout/
  features/        hooks + services for logic shared by 2+ pages
  lib/             api/client.ts (axios), utils
  store/           Zustand: auth.store, ui.store
  styles/          globals.css
  App.tsx          every route is declared here
```

**There are only two levels of nesting.** If you find yourself adding a third, stop and ask.

---

## Conventions

**Adding an API endpoint** — three steps, no controller file:

1. Write the logic in `<domain>.service.ts`. Services throw (`NotFoundError`,
   `BadRequestError`, …); they never touch `req` or `res`.
2. Add the route in `<domain>.routes.ts`, wrapped in `asyncHandler` so a rejected
   promise reaches the global error handler:

   ```ts
   floorsRouter.get('/:buildingId/floors',
     asyncHandler<{ buildingId: string }>(async (req, res) => {
       const floors = await getFloorsService(req.params.buildingId, req.resourceOwnerId!)
       sendSuccess(res, 'Floors fetched', floors)
     })
   )
   ```

   The `<{ buildingId: string }>` generic names the route params. Without it Express types
   them as `string | string[]`.
3. Mount the router in `src/app.ts` if the module is new.

`req.user` and `req.resourceOwnerId` are populated by the auth/rbac middleware and are
typed globally in `src/types/express.d.ts` — do not redeclare them per file.

**Adding a page:**

1. Create `src/pages/<area>/<Name>.tsx` with a default-exported component.
2. Register it in `src/App.tsx`. Nothing is file-system routed — a page that isn't in
   `App.tsx` is unreachable.
3. Reading a route param? Use `useRequiredParam('buildingId')`, not `useParams()`. It
   throws on a missing param instead of quietly sending `undefined` to the API.

**Where does data fetching go?**

- Used by **one page** → keep the `useQuery` / `useMutation` in that page.
- Used by **2+ pages** → move it to `src/features/<area>/`, as `hooks/use-x.ts` +
  `services/x.service.ts` (see `features/auth`).

Don't wrap a single-use query in a feature hook. That adds a file and a layer for nothing.

**Rules that apply everywhere:**

- Never commit a real `.env`. Both apps ignore every `.env*` except `.env.example`.
- Never log or commit tenant PII — Aadhaar/PAN documents, phone numbers, payment refs.
- Don't swallow errors. Surface them with a toast (web) or throw an `AppError` (api).
- `pnpm lint` must pass with **zero errors** in both apps before you push. Fix the code;
  don't relax the rule.

---

## How payments work

NestOS takes **no cut and processes no card data.** It uses UPI intent deep links: the
money moves directly between the tenant's and the owner's UPI apps.

```
1. Tenant taps "Pay via UPI"        POST /payments/create-order  { bookingId, type, month, year }
2. API creates a PENDING Payment    -> returns upiIntentUrl, payeeUpiId, payeeName, amount
3. Browser opens upiIntentUrl       the tenant's UPI app opens, prefilled (mobile only)
4. Tenant pays, gets a UTR
5. Tenant submits the UTR           PATCH /payments/:paymentId/upi-reference
6. Owner verifies and confirms      PATCH /payments/:paymentId/confirm  -> status SUCCESS
```

Step 5 matters: a UPI intent payment leaves **no server-side trail**. If the tenant never
submits a reference, the owner has nothing to check against their bank statement and the
payment stays `PENDING` forever.

The intent URL is built by `buildUpiIntentUrl` in `apps/api/src/modules/payments/`. Owners
must have set a UPI ID or `create-order` fails with a clear message.

Deposits use the same flow, triggered from the property detail page at booking time.

---

## Getting Started

### 1. Database Setup (Supabase)

We use Supabase for free PostgreSQL hosting.

1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **"New Project"**, name it `nestos`, create a strong database password, and pick
   a region close to you.
3. Wait a few minutes for the project to be provisioned.
4. Go to **Project Settings → Database**.
5. Under **Connection string**, select **URI**. It looks like:
   `postgresql://postgres:<YOUR-PASSWORD>@db.<YOUR-PROJECT-REF>.supabase.co:5432/postgres`

Everyone uses their **own** Supabase project. Don't share connection strings.

### 2. Configure Environment Variables

Each app ships a committed `.env.example` with placeholder values. Copy it and fill in
your own — never commit the filled-in file.

#### Backend (`apps/api/.env`)

```bash
cp apps/api/.env.example apps/api/.env
```

Then set `DATABASE_URL` to your own Supabase connection string (replace both
`<YOUR-PASSWORD>` and `<YOUR-PROJECT-REF>`), and generate your own JWT secrets — for
example with `openssl rand -hex 32`.

The API **will not start** without `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `EMAIL_HOST`, `EMAIL_USER` and `EMAIL_PASSWORD`. It exits with a
message naming the missing variable. For Gmail, `EMAIL_PASSWORD` must be an **App
Password**, not your account password.

`FRONTEND_URL` must exactly match the origin the web app runs on, or CORS will reject
every request.

#### Frontend (`apps/web/.env.local`)

```bash
cp apps/web/.env.example apps/web/.env.local
```

Vite only exposes variables prefixed `VITE_`. A `NEXT_PUBLIC_*` variable is silently
ignored and the app falls back to `http://localhost:4000/api/v1`.

### 3. Install Dependencies

This repo uses **pnpm** (`apps/api` pins `pnpm@10.32.1` via `packageManager`). On Windows
PowerShell, if you hit execution policy errors, run this once as Administrator:
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`

```bash
cd apps/api && pnpm install
cd ../web  && pnpm install
```

### 4. Setup Database Schema (Prisma)

```bash
cd apps/api
pnpm db:generate
pnpm db:push
```

*(Optional) seed some data: `pnpm db:seed`*

`prisma generate` reads `DATABASE_URL` from `.env`, so step 2 must be done first — even
though generating the client makes no database connection.

### 5. Start the Application

Two terminals:

```bash
# Terminal 1 — backend, http://localhost:4000
cd apps/api && pnpm dev

# Terminal 2 — frontend, http://localhost:3000
cd apps/web && pnpm dev
```

### 6. Verify

Open `http://localhost:3000` for the landing page, and `http://localhost:4000/health`
for `{"status":"ok",...}`.

### Useful commands

| Command | App | What it does |
|---|---|---|
| `pnpm dev` | both | Dev server with reload |
| `pnpm lint` | api | `tsc --noEmit` — type check |
| `pnpm lint` | web | ESLint — must be 0 errors |
| `pnpm build` | both | Type check + compile |
| `pnpm db:studio` | api | Browse the database in a GUI |

There is **no test suite yet.** `pnpm lint` and `pnpm build` are the only automated
checks, so run both before pushing.

---

## Known issues

Actively under development. These are known and **deliberately not yet fixed** — please
don't file them again, and check here before assuming something you wrote is broken.

### Broken now — you will hit these

| # | Issue | Effect |
|---|---|---|
| 1 | `noticesRouter` is mounted at `/owner/notices` **and** `/tenant/notices`, but its own paths are `/owner` and `/tenant`, so real URLs are `/owner/notices/owner`. The web app calls `/owner/notices`. | Notices 404 for both roles. Either fix the mounts in `app.ts` or the paths in `notices.routes.ts` — not both. |
| 2 | `GET /buildings/search` is registered **after** `/:buildingId`, which matches first. | Property search never reaches its handler. Move it above `/:buildingId`. |
| 3 | `buildingsRouter.use(authenticate, requireVerifiedOwner)` also covers `/search` and `/:buildingId/public`, which are meant to be public. | Tenants can't search or view properties. Move those two routes to their own router, or apply the guard per-route. |
| 4 | `POST /auth/refresh-token` is a `501` stub, but the axios interceptor calls it on every 401. | Any expired access token logs the user straight out instead of refreshing silently. |
| 5 | File uploads (`/uploads/presigned-url`, `/uploads/confirm`) return `501`. | Owner verification and Aadhaar upload can't be completed. The frontend expects an S3-style presigned flow; the backend is configured for local disk. |

### Fix before anyone real uses this

| # | Issue |
|---|---|
| 6 | `app.ts` serves the whole `UPLOAD_DIR` through **unauthenticated** `express.static`. These are Aadhaar/PAN/selfie documents. **Do not build the upload flow until this is an authenticated route.** |
| 7 | `pnpm start` is broken: `tsc` doesn't rewrite path aliases, so `dist/index.js` does `require("@config/env")` and crashes. Only affects production builds — `pnpm dev` works via `tsconfig-paths`. Fix with `tsc-alias` or by dropping the aliases. |
| 8 | `EMAIL_FROM` in `config/env.ts` defaults to a personal Gmail address. Set `EMAIL_FROM` in `.env`. |
| 9 | No shared types package — `apps/web/src/types/index.ts` mirrors the Prisma schema by hand and will drift. |
| 10 | No tests and no CI. |

---

## What changed in the cleanup

If you knew this repo before, here's what moved and why.

**The frontend was already migrated off Next.js**, but the leftovers were still there and
made it look like a Next app. Removed: `next.config.ts`, the Next svgs, the unused PostCSS
config, both `refactor*.js` codemods, `package-lock.json`, and 32 no-op `'use client'`
directives. ESLint was importing an uninstalled `eslint-config-next` and had **never run**;
it now works, and all 48 errors it found are fixed.

**Pages were flattened.** The `(group)` and `[bracket]` folders meant nothing under Vite,
and all 25 pages were named `page.tsx`:

```
src/app/(owner)/owner/buildings/[buildingId]/rooms/[roomId]/page.tsx
  ->  src/pages/owner/RoomDetail.tsx
src/app/(tenant)/layout.tsx  ->  src/layouts/TenantLayout.tsx
src/app/globals.css          ->  src/styles/globals.css
```

Done with `git mv`, so `git log --follow <file>` still works.

**The API lost its controller layer.** All 14 `*.controller.ts` files are gone. They held
no logic — 61 copies of `try { … } catch (err) { next(err) }` plus an
`AuthenticatedRequest` type redeclared in 16 files that already existed globally in
`types/express.d.ts`. `asyncHandler` replaced all of it. Folder depth did not change; a
module is now **routes + service (+ validation)**.

**Bugs fixed along the way:** the API couldn't boot (missing `uploads` module),
`pnpm build` had never succeeded on the web app, five sidebar links pointed at unrouted
pages, both issue-detail pages read the wrong route param and always fetched `undefined`,
and the owner settings form defined a Zod schema that was never wired to a resolver.

**Nothing in `services/` was touched.** All business logic is byte-for-byte unchanged.

---

## Collaboration

- Branch off `main`; never commit to `main` directly.
- Run `pnpm lint` and `pnpm build` in **both** apps before pushing.
- Keep commits scoped — one concern per commit.
- Update this README when you change setup steps, conventions, or fix anything in
  [Known issues](#known-issues).

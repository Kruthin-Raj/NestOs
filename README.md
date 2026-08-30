# NestOS — PG & Hostel Management System

NestOS is a platform for managing PGs, hostels, and shared accommodations, for both
property owners and tenants.

> **New to this repo?** Read [Architecture](#architecture), [Repo structure](#repo-structure)
> and [Conventions](#conventions) before writing code. If you last saw this repo when it was
> a Next.js app, read [What changed in the cleanup](#what-changed-in-the-cleanup) — files moved.
>
> **Just want it running?** [Getting Started](#getting-started), then
> [Accounts and passwords](#accounts-and-passwords) and
> [Getting an owner verified](#getting-an-owner-verified) — the owner dashboard is gated
> behind approval, and that trips everyone up once.
>
> **Putting it online?** Read [Before you deploy](#before-you-deploy) first — HTTPS and
> cookie settings decide whether login works at all.
>
> **Joining the team?** We share one database — read
> [Working as a team](#working-as-a-team) before running anything destructive.

## Tech Stack

- **Frontend**: React 19 + Vite, React Router 7, Tailwind CSS v4, TanStack Query,
  Zustand, react-hook-form + Zod, Leaflet (maps), Recharts
- **Backend**: Node.js, Express 5, Prisma 7 ORM, Zod validation, JWT in httpOnly cookies
- **Database**: PostgreSQL (hosted on Supabase)
- **Payments**: Direct UPI Intent (zero fee) — see [How payments work](#how-payments-work)
- **File Storage**: Local disk under `UPLOAD_DIR`. Documents are **never** served
  statically — see [How uploads work](#how-uploads-work)

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

**Auth is email + password, over cookies.** Signing in sets two httpOnly cookies
(`nestos_token`, `nestos_refresh`). The browser sends them automatically because axios
sets `withCredentials: true` and the API sets `cors({ credentials: true })`.

A one-time code is used for exactly two things: confirming the address at signup, and
authorising a password reset. It is not a way to log in. See
[Accounts and passwords](#accounts-and-passwords).

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

Deposits use the same flow, and confirming one is what completes a booking: the booking
becomes `CONFIRMED`, the bed `OCCUPIED` and the tenant `ACTIVE`. Until then the booking
stays `PENDING` with the bed held. A tenant pays the deposit from **`/tenant/bookings`**;
rent is only payable once the booking is confirmed.

Owners confirm payments at **`/owner/payments`**, where each pending payment shows the
tenant's UPI reference.

Booking has three gates in order: the tenant's ID must be verified, their profile at least
70% complete, and the bed vacant. A tenant with an active booking must cancel it before
making another.

---

## Nearby search

`GET /buildings/search` takes `lat`, `lng` and `radiusKm`. Supplying both coordinates
switches it into proximity mode: results are limited to the radius, ordered nearest first,
and each item carries a `distanceKm`. Without them it behaves exactly as before.

```
GET /buildings/search?lat=17.4485&lng=78.3908&radiusKm=5
```

A bounding box narrows candidates in SQL first — `@@index([latitude, longitude])` covers
it — then exact Haversine distance is computed in memory, the corners of the box are
trimmed to a true circle, and the page is taken from the ranked list. No PostGIS and no
raw SQL. `radiusKm` is clamped to 0.5–100, and coordinates that are missing or nonsense
fall back to an ordinary search rather than failing.

On the tenant search page this is the **Near me** button, which uses the browser's
geolocation (see [Before you deploy](#before-you-deploy) — it needs HTTPS outside
localhost).

**Only buildings with coordinates can appear.** They are set with the map picker on the
building form, so any property created before that existed has `NULL` and will not show up
in a nearby search — it is still found by city.

---

## Getting Started

### 1. Database Setup (Supabase)

Supabase hosts our PostgreSQL, and **contributors share one project** — see
[Working as a team](#working-as-a-team). Ask for the connection string rather than
creating your own project.

In the Supabase dashboard, open **Connect** and copy the **Session pooler** URI:

```
postgresql://postgres.<PROJECT-REF>:<PASSWORD>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Note the username is `postgres.<PROJECT-REF>`, not plain `postgres`.

**Do not use the direct connection** (`db.<PROJECT-REF>.supabase.co`). It has no IPv4
address on the free plan, so on any IPv4-only network — most college and office WiFi — it
fails with `Can't reach database server` and no amount of code will fix it. The pooler is
dual-stack.

Use **Session pooler (5432)**, not **Transaction pooler (6543)**: transaction mode has no
prepared statements, so `pnpm db:push` and `prisma migrate` fail against it.

### 2. Configure Environment Variables

Each app ships a committed `.env.example` with placeholder values. Copy it and fill in
your own — never commit the filled-in file.

#### Backend (`apps/api/.env`)

```bash
cp apps/api/.env.example apps/api/.env
```

Set `DATABASE_URL` to the shared pooler string from step 1, and generate your own JWT
secrets (they only sign cookies from your local API, so they need not match anyone
else's):

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**`EMAIL_*` can stay as placeholders.** In development the one-time code prints to the
API terminal, so signup and password reset work with no mail server:

```
🔥 DEV OTP for you@example.com: 123456
```

For real delivery, `EMAIL_PASSWORD` must be a 16-character Gmail **App Password**
generated on the account in `EMAIL_USER`, not your account password.

The API **will not start** without `DATABASE_URL`, `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `EMAIL_HOST`, `EMAIL_USER` and `EMAIL_PASSWORD`. It exits with a
message naming the missing variable — placeholders satisfy it, absence does not. Define
each key exactly once; a duplicate silently keeps the last.

`FRONTEND_URL` must exactly match the origin the web app runs on, or CORS will reject
every request.

#### Frontend (`apps/web/.env.local`)

```bash
cp apps/web/.env.example apps/web/.env.local
```
Or manually create `.env.local`:
```env
VITE_API_URL=http://localhost:4000/api/v1
VITE_APP_NAME=NestOS
VITE_APP_URL=http://localhost:3000
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

Re-run `pnpm db:generate && pnpm db:push` after pulling changes that touch
`schema.prisma` — otherwise the generated client asks for columns the database does not
have, and every query touching that table fails with a confusing
`column "(not available)" does not exist`.

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
*The Web app will start instantly at http://localhost:3000 (Vite is incredibly fast!)*

### 6. Verify

Open `http://localhost:3000` for the landing page, and `http://localhost:4000/health`
for `{"status":"ok",...}`.

### Useful commands

- `/apps/api`: Node.js Express backend, Prisma schema, and business logic.
- `/apps/web`: Vite React frontend, components, and UI pages.

| Command | App | What it does |
|---|---|---|
| `pnpm dev` | both | Dev server with reload |
| `pnpm lint` | api | Type check of `src/` **and** `prisma/*.ts` |
| `pnpm lint` | web | ESLint — must be 0 errors |
| `pnpm build` | both | Type check + compile |
| `pnpm db:studio` | api | Browse the database in a GUI |
| `pnpm admin:create <email>` | api | Create a SUPER_ADMIN (cannot be done via signup) |
| `pnpm user:set-password <email> <password>` | api | Set a password directly, for accounts whose inbox is unreachable |

There is **no test suite yet.** `pnpm lint` and `pnpm build` are the only automated
checks, so run both before pushing.

---

## How uploads work

Identity documents (Aadhaar, PAN, selfies) are stored on local disk under `UPLOAD_DIR`.
They are **never** served statically. Three steps, mirroring an S3 presigned flow:

```
1. POST /uploads/presigned-url   -> { uploadUrl, fileKey, expiresInSeconds }
2. PUT  <uploadUrl>              raw file body; no cookie, the signed token authorizes
3. POST /uploads/confirm         -> creates the Owner/TenantDocument row
```

`uploadUrl` points back at this API and embeds a short-lived signed token. **The token —
not any request field — decides where the bytes land**, which is what makes step 2 safe
without a session cookie (the browser's `fetch()` sends none).

Reads go through `GET /uploads/documents/:documentId`, which allows the owning user, or a
`SUPER_ADMIN` reviewing verification, and nobody else. Files come back as attachments with
`Cache-Control: no-store`.

**If you add anything here, do not reintroduce a static mount for `UPLOAD_DIR`.** That was
the original bug: every document was readable by anyone who guessed a filename.

## Adding rooms in bulk

A 100-room building is not entered one form at a time. **Add many** on the rooms page
generates a numbered run of identical rooms, each with its beds, in one transaction:

```
POST /buildings/:buildingId/rooms/bulk
{ floorId, startNumber: 101, count: 100, type: "SHARED",
  capacity: 2, baseRent: 6000, prefix: "A-", padTo: 3,
  bedLabelStyle: "ALPHA" }
```

- Room numbers are `prefix + number`, optionally zero-padded — `A-001`, `A-002`.
- Each room gets `capacity` beds, labelled `A, B, C…` or `1, 2, 3…`.
- Numbers already used in that building are **skipped, not failed**, and returned in
  `skipped` so the owner can see what was left alone.
- The same capacity rules as a single room apply, so bulk is not a way around validation.
- Capped at 200 rooms per call.

The preview in the form is generated by the same rule the API uses, so what an owner sees
before submitting is what gets created.

---

## Roommate compatibility

Lifestyle answers were collected at tenant onboarding and never used. They now produce a
match score on the property page, per room:

- **Shared rooms only, and only when someone already lives there.** A private room has
  nobody to be compatible with, and an empty shared room has nothing to compare against —
  the score is simply absent in both cases (`buildings/compatibility.ts`,
  gated in `getPublicPropertyService`).
- Five dimensions, weighted by how much friction they cause in practice: smoking (3),
  cleanliness (3), sleep schedule (2), drinking (2), food (2).
- Ordered scales score by distance, so `EARLY_BIRD` vs `FLEXIBLE` costs less than
  `EARLY_BIRD` vs `NIGHT_OWL`. Food is not a scale — it only matters across the
  veg / non-veg line, and `ANY` gets along with everyone.
- Scores are averaged across occupants: one mismatched person in a four-bed room lowers
  the score rather than vetoing it.
- **When nothing can be compared the score is `null`, not `0` or `50`.** "We don't know"
  and "you clash" are very different things to show someone deciding where to live.

The UI shows the number, a bar, and the specific dimensions under *Differs on* /
*Agrees on* — a bare percentage is not actionable.

---

## Visits

A tenant can ask to see a place before committing to it. `VisitRequest` is deliberately
**separate from `Booking`**: a visit reserves nothing and holds no bed, so browsing can
never block inventory.

```
POST   /tenant/visits                  { buildingId, requestedAt, tenantNote? }
GET    /tenant/visits
POST   /tenant/visits/:visitId/cancel
GET    /owner/visits
POST   /owner/visits/:visitId/respond  { action: CONFIRM | DECLINE, confirmedAt?, ownerNote? }
POST   /owner/visits/:visitId/cancel
```

- Confirming may **move the slot** — owners rarely have the exact time free — so
  `confirmedAt` is stored separately from `requestedAt` and the tenant is shown that it
  changed.
- One open request per tenant per property, and at most 5 open at once.
- Either side can cancel anything that has not happened yet.
- The tenant's phone number is only shown to the owner **after** the visit is confirmed.

---

## Notices

An owner posts an announcement; the tenants it applies to see it on their dashboard.
`Notice.targetType` decides who "applies":

| targetType | Reaches | UI label |
|---|---|---|
| `ALL_BUILDINGS` | every tenant of **that owner** | All my buildings |
| `BUILDING` | tenants with a booking in one building | One building |
| `FLOOR` / `ROOM` | tenants on that floor / in that room | *(API only)* |
| `TENANT` | one named tenant | Specific tenant |

Audience rules live in **`tenantNoticeScope`** (`notices.service.ts`), shared by the list,
the unread badge and mark-all-read so the three cannot disagree. Change them there, not at
the call sites. Two rules that have each been broken once:

- `ALL_BUILDINGS` means *that owner's* buildings, never every building on the platform.
- Every other target type requires its id, or the notice reaches nobody while still
  reporting success.

Visibility follows **confirmed** bookings only.

---

## Accounts and passwords

Sign in is **email + password**. A one-time code is only used to confirm an address at
signup and to authorise a password reset.

| Flow | What happens |
|---|---|
| **Signup** | `/signup` — pick a role, set an email and password. The account is created unverified and a 6-digit code is emailed. Entering it confirms the address and signs you in. |
| **Login** | `/login` — email and password. A wrong password and an unknown email give the same error, so the form cannot be used to discover which accounts exist. |
| **Forgot password** | `/forgot-password` — a code is emailed, then you set a new password and are signed in. Every existing session is revoked. |

### Account status

Every user carries a `status`, which an admin sets from `/admin/users`:

| Status | Effect |
|---|---|
| `ACTIVE` | Normal. |
| `SUSPENDED` / `DEACTIVATED` / `BLOCKED` | Cannot log in, and any live session stops working **immediately**. |

Immediately is the point. Each user has a `tokenVersion` stamped into their JWT and
checked on every request; changing status increments it and revokes their refresh tokens,
so a blocked account is out at once rather than when its access token happens to expire.
The cost is a database read per authenticated request.

`authenticate` returns `ACCOUNT_BLOCKED`, `ACCOUNT_SUSPENDED` or `ACCOUNT_DEACTIVATED` —
distinguish these from an ordinary 401 when handling errors in the UI.

Deleting a user is a soft delete: `deletedAt` is set and the email and phone are suffixed
so the address can be registered again.

**Accounts created before password login have no password.** `users.passwordHash` is
nullable, so nothing needed migrating: logging in returns `PASSWORD_NOT_SET` and the UI
sends you to *Forgot password* to set one. That is the normal path for any older account.

For an account whose inbox cannot receive mail, set one directly instead:

```bash
cd apps/api
pnpm user:set-password someone@example.com 'YourPassword1'
```

This is also the fastest way to fix an admin, since `pnpm admin:create` creates the
account with **no password at all** — it predates password login — and you cannot sign in
until you run the command above.

Admins cannot sign up: `auth.validation.ts` restricts self-signup to `OWNER` and `TENANT`.
Create one with `pnpm admin:create <email>`.

**If email is not working locally,** the code is still printed in the API terminal:

```
🔥 EMAIL FAILED — OTP for you@example.com: 481920
```

The signup screen will show an error in that case even though the account was created —
retrying the signup with the same email re-sends the code.

---

## Getting an owner verified

Most owner routes require `verificationStatus = VERIFIED`, so a fresh owner account can't
reach the dashboard until it's approved. The full path is:

1. Owner signs up and uploads documents on the onboarding page — Aadhaar front + back, a
   selfie, and at least one property document (all four are required).
2. Owner submits, which moves them to `UNDER_REVIEW`.
3. A `SUPER_ADMIN` reviews them at **`/admin/owners`** and approves or rejects.

Admins cannot sign up — `auth.validation.ts` restricts self-signup to `OWNER` and
`TENANT`. Create one with:

```bash
cd apps/api
pnpm admin:create you@example.com
pnpm user:set-password you@example.com 'YourAdminPassword1'
```

Both commands are needed: `admin:create` does not set a password, so without the second
one there is no way to sign in. Then sign in at `/login` and open `/admin`.

We share a database, so there is normally **one admin already** — ask rather than creating
another. `pnpm db:seed` upserts that same admin, so it is safe to run;
`SEED_ADMIN_EMAIL=you@example.com pnpm db:seed` targets your own local database instead.

### Skipping owner verification locally

```bash
pnpm owner:create owner@example.com 'ChosenPassword1' 'Owner Name'
```

Creates a pre-verified owner. **Development only** — pointed at an existing email it
overwrites that owner's password and force-verifies them.

Or open `pnpm db:studio` and set
`owner_profiles.verificationStatus` to `VERIFIED` directly.

## Before you deploy

Everything below works on localhost and behaves differently once it is not. None of it
needs changing to develop; all of it matters the day you put this on the internet.

### 1. Serve both apps over HTTPS

`src/utils/jwt.util.ts` sets the auth cookies with `secure: env.isProduction`. Over plain
`http://` the browser accepts the cookie and then refuses to send it back, so login
returns `200` and every request after it is unauthenticated. It looks like a bug in the
code; it is the browser doing exactly what it was told.

`navigator.geolocation` — "Near me" on tenant search, and "Use my location" in the
building location picker — is also only available in a secure context. **localhost is
exempt**, which is why both work in development. On plain HTTP in production they fail.
The maps themselves still render; only locating the user is blocked.

### 2. Put both apps on the same site, or loosen SameSite

Production cookies use `sameSite: 'strict'`. "Site" means the registrable domain — the
port is not part of it, which is why `localhost:3000` talking to `localhost:4000` is fine.

| Deployment | Works? |
|---|---|
| `app.example.com` + `api.example.com` | yes — same site |
| `example.com` serving both | yes |
| `something.vercel.app` + `something.onrender.com` | **no — different sites** |

The last row is a common free-tier split and it fails confusingly: login succeeds, then
everything 401s, because the cookie is never sent. If you must split hosts, the cookies
need `sameSite: 'none'`, which in turn requires `secure: true` and therefore HTTPS on
both.

Whatever you choose, `FRONTEND_URL` on the API must exactly match the web origin or CORS
rejects everything.

### 3. Move uploads off local disk

`UPLOAD_DIR` is a directory on the server. Render, Railway, Heroku and similar hosts give
you an **ephemeral filesystem**: it is wiped on every deploy and restart. Uploaded Aadhaar
and PAN documents disappear while their database rows still point at them, and separate
instances cannot see each other's files.

The fix is object storage (S3, Supabase Storage, Cloudflare R2). The upload flow is
already shaped for it — `presigned-url` then `PUT` then `confirm` — so only the storage
adapter and the authorized read route need to change.

### 4. Replace the map tiles for real traffic

OpenStreetMap tiles are free and need no API key, but their usage policy targets
development and light use; heavy traffic gets throttled or blocked. For production use a
tile provider (MapTiler, Stadia, Carto — these do need keys) or self-host. Only the
`L.tileLayer(...)` URL in `location-picker.tsx` and `Map.tsx` changes.

### 5. Know the free-tier limits

A free Supabase project **pauses after about 7 days of inactivity** — a sudden "Can't
reach database" usually means resuming it from the dashboard rather than a code problem.
The other common cause of that same message is using the direct connection on an
IPv4-only network; see [Database Setup](#1-database-setup-supabase).

Connections go through the Session pooler already, which is what you want with several
contributors running the API at once. Free-tier connection limits still apply.

### 6. Accept what is deliberately manual

Payment confirmation is a human step: a UPI intent payment leaves no server-side trail, so
nothing stops an owner confirming money that never arrived. That is inherent to zero-fee
UPI — the alternative is a payment gateway with webhooks. See
[How payments work](#how-payments-work).

There are also no tests and no CI, so every regression is found by a human in a browser.

---

## Roadmap

Ideas worth building, with what each actually costs. **Most need no external service** —
the ones that do are called out, because that is usually the deciding factor.

### Two products in one

This is the biggest open design question. The data model is **bed-centric**:
`Building → Floor → Room → Bed`, and a tenant books a *bed*. That is right for a PG or
hostel, and wrong for an apartment let to a family, who rent the whole unit on one
agreement.

The cheap fix is not two apps. Add `rentalMode: PER_BED | WHOLE_UNIT` to `Building` and
branch on it:

| | PER_BED (PG) | WHOLE_UNIT (apartment) |
|---|---|---|
| Booked thing | a bed | the flat |
| Rent shown | per bed | per flat |
| Room form | rooms with beds | flats with BHK, carpet area, furnishing |
| Gender preference | meaningful | usually not asked |
| Roommate matching | meaningful | not shown |
| Deposit | 1–2 months | often 6–10 months |

Bookings, payments and issues need no schema change: a whole-unit flat is modelled as one
room with one bed, and the UI stops saying "bed". Most of the work is wording and which
fields a form shows.

### Money — the biggest owner pain

**None of these need a paid API except WhatsApp.**

| Feature | External service? |
|---|---|
| Generate rent on the due day | None. A scheduled job creates the `Payment` rows. |
| Overdue reminders by **email** | None — SMTP already works. Gmail allows roughly 500/day. |
| Overdue reminders by **WhatsApp** | **Yes, and it is the awkward one.** The WhatsApp Business API needs a provider (Meta Cloud API, Twilio, Gupshup), business verification, and templates approved before you may send. Meta's free tier covers a limited number of conversations. Do email first. |
| Expense tracking (electricity, salaries, repairs) | None. A model and two screens; gives real profit per building instead of revenue. |
| Deposit ledger with move-out deductions | None. Data model only. |

**The one piece of infrastructure needed** is something to run daily. Ranked by how free
and how reliable:

1. **GitHub Actions on a schedule** calling a protected endpoint — free (2,000 min/month),
   works whatever the host, easy to trigger by hand. Recommended.
2. **Supabase `pg_cron`** — available on the free tier, runs inside the database.
3. **`node-cron` inside the API** — no setup, but dies whenever the host sleeps a free
   instance, which is exactly when rent day arrives.
4. **Host cron** (Render, Railway) — reliable, generally a paid plan.

Whichever runs it, make the job **idempotent**: generating August rent twice must not
create two rows. Key on `(bookingId, type, billingMonth, billingYear)`.

### Tenant-facing

| Feature | Notes |
|---|---|
| ~~Roommate compatibility~~ | **Built** — see [Roommate compatibility](#roommate-compatibility). |
| ~~Visit scheduling~~ | **Built** — see [Visits](#visits). |
| **Digital rent agreement** | Generating and storing a PDF is easy. **A legally meaningful signature is not.** Typing a name proves very little; real e-sign in India means Aadhaar eSign through a licensed provider, or DocuSign, both paid. Ship it as an *unsigned agreement to download* and be honest that it is not e-signed. |

### Operations

- **Assign issues to staff** with due dates — issues exist, but there is no plumber or
  electrician to route them to.
- **Recurring maintenance** — tank cleaning, pest control, lift AMC, on a schedule. Uses
  the same scheduled job as rent generation.
- **Vendor directory** with cost history per building.

### Occupancy

- **Move-out flow** — notice period, final settlement, deposit refund. **A tenancy
  currently has no ending**, which is the largest functional gap left.
- **Visual bed map** — a grid of the building showing vacant and occupied at a glance.
- **Waiting list** for full properties.

### Platform

- **PWA** — a manifest and service worker make the site installable on a phone, reusing
  100% of the current React code. A day of work, no app store.
- **React Native app** — reuses the whole backend but rewrites every screen. Weeks, not
  days. Note that auth is httpOnly cookies, which native apps handle badly; the API would
  need to accept `Authorization: Bearer` too. The JWTs already exist, so it is a small
  change — but plan for it.

---

## Known issues

Actively under development. Check here before assuming something you wrote is broken.

### Open

| # | Issue |
|---|---|
| 9 | No shared types package — `apps/web/src/types/index.ts` mirrors the Prisma schema by hand and will drift. |
| 10 | No tests and no CI. `pnpm lint` and `pnpm build` are the only automated checks. |
| 11 | `dashboardRouter` is mounted at both `/owner/dashboard` and `/tenant/dashboard` while defining `/owner` and `/tenant` paths, so the real URLs double up (`/owner/dashboard/owner`). It works and the frontend matches, but it reads oddly — this is the same shape that made notices 404 before it was fixed. |
| 13 | Payment confirmation is a manual trust step — see [Before you deploy](#before-you-deploy). |
| 14 | Uploads live on local disk and do not survive a redeploy on an ephemeral filesystem — see [Before you deploy](#before-you-deploy). |
| 15 | A building with no coordinates cannot appear in a nearby search. Older buildings predate the map picker. City search is unaffected. |
| 17 | Contributors share one database, so a destructive command or a schema push affects everyone — see [Working as a team](#working-as-a-team). |

### Fixed

Issues 1–8 are resolved: notices routing, property search ordering, public property access
for tenants, token refresh, file uploads, the unauthenticated document mount, the broken
`pnpm start`, and the personal-Gmail `EMAIL_FROM` default. See `CLAUDE-FIX.md` for detail.

Issue 12 (no user management) is resolved by the admin module — see
[Account status](#account-status). Issue 16 (no migration history) is resolved:
`prisma/migrations` is now the source of truth and `prisma migrate status` reports the
database up to date. Prefer `pnpm db:migrate` over `pnpm db:push` from here on, so the
history keeps matching the schema.

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

## Working as a team

**We share one Supabase project**, so the accounts and buildings you see are your
teammates'. Consequences:

- `pnpm db:reset` and `db push --force-reset` **wipe everyone's data**. Ask first.
- `pnpm db:push` applies your `schema.prisma` to the shared database — tell the others so
  they can run `pnpm db:generate`.
- Prefix throwaway accounts (`test-kruthin@…`) and delete them afterwards.
- It holds real PII: Aadhaar numbers, phone numbers, payment references.

To break things freely, run Postgres locally and point only your own `DATABASE_URL` at it:

```bash
docker run -d --name nestos-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=nestos \
  -p 5433:5432 postgres:16-alpine
# DATABASE_URL=postgresql://postgres:postgres@localhost:5433/nestos
```

Share the connection string through a password manager, never a commit or a chat log.
`EMAIL_*` never needs sharing.

### Before you push

- Branch off `main`; never commit to `main` directly.
- Run `pnpm lint` in **both** apps and `pnpm build` in `apps/web`. Zero lint errors.
  Note that `apps/api`'s `lint` is a type check, not ESLint — and that it runs twice:
  once for `src/`, once for the scripts in `prisma/` via `tsconfig.scripts.json`.
  Do not drop the second one; while `prisma/` went unchecked, a schema change left
  `db:seed`, `admin:create` and `owner:create` broken with every gate still green.
- Keep commits scoped — one concern per commit, and make the message match what the
  commit actually changes.
- Update this README when you change setup steps, conventions, or fix anything in
  [Known issues](#known-issues).

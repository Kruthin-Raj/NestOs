# Cleanup & Refactor — What Changed and What I Found

Branch: `chore/cleanup-vite-migration` → `main` · 18 commits · 98 files changed
(+2,694 / −10,079) · 25 deleted, 31 renamed, 7 added

This document exists so reviewers don't have to reverse-engineer the branch. It covers
what was broken before, what I changed, what I found and deliberately left alone, and
exactly how far the verification goes.

**Nothing in any `*.service.ts` was modified.** All business logic is byte-for-byte
unchanged. The branch touches the HTTP layer, the frontend file layout, dead code, and docs.

---

## 1. The starting state

Three things were broken badly enough that neither app could be built or run:

| What | Why |
|---|---|
| **The API could not start at all** | `src/app.ts:16` imported `@modules/uploads/uploads.routes`, which did not exist. ts-node threw at require time, so `pnpm dev`, `pnpm build` and `pnpm lint` all failed. |
| **The web app had never built successfully** | 12 TypeScript errors from `useParams()` returning `string \| undefined`, left behind by the Next.js → React Router codemod. `refactor2.js` even contains a comment noting it gave up on them. |
| **ESLint had never run** | `eslint.config.mjs` imported `eslint-config-next`, which was not installed. `pnpm lint` crashed every time, so no lint error in the repo had ever been seen. |

The repo also described itself incorrectly: the README said **Next.js**, but `apps/web` has
no `next` dependency and `"dev": "vite"`. It is a Vite SPA with React Router. The Next.js
files were leftovers from an abandoned migration.

---

## 2. What I changed

### Phase 1 — Unblock and clean up

- **Created `apps/api/src/modules/uploads/uploads.routes.ts`** as an explicit `501` stub
  that logs a warning. Not a real implementation: the frontend expects an S3-style
  presigned flow, the backend has local-disk config and no object-storage client, and the
  files involved are Aadhaar/PAN documents. A 501 makes the API boot while keeping the
  failure loud. See finding **F5**.
- **Fixed the frontend API URL.** The README documented `NEXT_PUBLIC_API_URL`, but
  `lib/api/client.ts:3` reads `VITE_API_URL`. Vite only exposes `VITE_*`, so the documented
  variable was dead and any deployed build silently pointed at `localhost`.
- **Added `.env.example` to both apps** and tightened the ignore rules. `apps/api/.gitignore`
  previously only ignored `.env`, so `.env.local` or `.env.production` would have been
  committable. Both apps now ignore every `.env*` and whitelist only the example.
- **Removed the Next.js debris:** `next.config.ts`, `postcss.config.mjs` (Tailwind v4 goes
  through the Vite plugin), `next.svg`, `vercel.svg`, `refactor.js`, `refactor2.js`,
  `package-lock.json` (this repo uses pnpm), `AGENTS.md`, `CLAUDE.md`, and 32 inert
  `'use client'` directives. Moved `favicon.ico` into `public/`, where `index.html` was
  already looking for it — it had been 404ing.
- **Replaced the ESLint config** with a plain typescript-eslint one. It surfaced 48
  pre-existing errors, **all fixed rather than silenced** — no rule was relaxed.
- **Rewrote the README** (see §6).

### Phase 2 — Skipped

A test harness was planned here. Skipped on request. See §5 for what that costs.

### Phase 3 — Deleted the API controller layer

The folder structure was never the problem — `config/`, `middleware/`, `modules/`,
`types/`, `utils/` are all justified and only two levels deep. The redundancy was a
**layer**:

| | Before | After |
|---|---|---|
| `*.controller.ts` files | 14 | **0** |
| `try { … } catch (err) { next(err) }` blocks | 61 | 0 |
| Hand-written `AuthenticatedRequest` types | 16 files | 0 |
| `src/` total lines | 6,686 | 6,219 |

Every controller was plumbing: a try/catch, a response helper call, and a local
`AuthenticatedRequest` type that duplicated the global augmentation already present in
`src/types/express.d.ts`. One `asyncHandler` utility replaced all of it.

**Folder depth did not change.** A module is now `routes` + `service` (+ `validation`).

Done one or two modules per commit, with `tsc --noEmit` green before each commit. Route
paths, middleware order, status codes and response messages were copied verbatim —
including the pre-existing oddities in §3, which a refactor must not silently "fix".

### Phase 4 — Flattened the web route tree

Routes are declared centrally in `App.tsx`, but files sat in Next's filesystem convention.
Under Vite, `(group)` and `[bracket]` folders mean nothing — they were just directory names
to keep manually in sync, and all 25 pages were named `page.tsx`.

```
src/app/(owner)/owner/buildings/[buildingId]/rooms/[roomId]/page.tsx
  ->  src/pages/owner/RoomDetail.tsx
src/app/(tenant)/layout.tsx   ->  src/layouts/TenantLayout.tsx
src/app/globals.css           ->  src/styles/globals.css
```

All via `git mv`, so `git log --follow` still works. No file contents changed except the
two entry points (`App.tsx` imports, `main.tsx` stylesheet path) — every page already
imported through the `@/` alias.

**I deliberately did less than planned on data fetching.** The plan was to move all 18
inline-query pages into `features/` hooks. I didn't: each of those queries is used by
exactly one page, so it would have added ~20 files and another layer while removing zero
duplication — the opposite of the goal. I extracted only what was genuinely duplicated (an
identical `patch /users/profile` mutation in both settings pages) and set a rule, now in
the README: **extract to `features/` at 2+ consumers, otherwise keep it in the page.**

### Restored: the UPI payment flow

While clearing lint errors I removed a `useMutation` in `tenant/Payments` that had no
caller, and a `quickActions` value that was read but never rendered. **I was wrong to treat
the payment one as dead code** — the README, the `Payment` model (`upiTransactionId`,
`confirmedByOwnerId`), `/payments/create-order` returning `upiIntentUrl`, and
`PropertyDetail` already using the same flow for deposits all show it is the current
design. Only the button was missing.

Restored the mutation verbatim and wired it up. Doing so exposed two gaps:

- **`create-order` requires a `bookingId`, which `quickActions` does not carry.** The
  payments page now reads the active booking from `/bookings/my`; `PAY_RENT` on the
  dashboard links to the payments page rather than paying directly.
- **`PATCH /payments/:paymentId/upi-reference` existed with no caller.** It is
  load-bearing: a UPI intent payment leaves no server-side trail, so without the tenant
  submitting a UTR the owner has nothing to reconcile against their bank statement and the
  payment stays `PENDING` forever. Added a UTR field on pending payments, closing the loop:
  pay → submit UTR → owner confirms.

`quickActions` is now rendered on the tenant dashboard. No card data touches NestOS — the
intent URL opens the tenant's own UPI app prefilled with the owner's VPA and amount.

---

## 3. Bugs found and fixed

| Where | Bug |
|---|---|
| `api/src/app.ts:16` | Imported a module that never existed — the API could not boot. |
| `web/src/App.tsx` + both sidebars | **5 dead nav links.** `owner-sidebar.tsx` and `tenant-sidebar.tsx` linked to `/owner/{payments,notices,settings}` and `/tenant/{notices,settings}`; none were registered in `App.tsx`. The pages existed. Clicking them rendered a blank screen, and there was no catch-all route either. Routed all five, added a 404 page. |
| both issue-detail pages | The route declared `:issuesId`, the pages read `useParams().issueId`. **The id was always `undefined`** and the pages fetched with an undefined key. Route param renamed to `:issueId` (URLs unchanged — only the key differs). |
| 6 pages | `useParams()` is `string \| undefined`, but the code assumed `string` — 12 build errors. Added `useRequiredParam()`, which **throws** on a missing param rather than sending `undefined` to the API. |
| `owner/Settings.tsx` | Defined a Zod schema including an Indian-mobile regex, but `useForm` had **no resolver** — none of that validation ever ran. Wired it up. |
| `owner/BuildingNew.tsx` | A resolver type error was masked with `as any`. The schema uses `z.coerce.number()`, so its input and output types differ; fixed properly with `useForm`'s third generic instead of the cast. |
| `owner/Notices.tsx` | `isLoading` was destructured but never used — no loading state. Now renders `<PageLoader />` like every sibling page. |
| `.gitignore` (root) | A bare `uploads/` pattern is unanchored and matched **any** directory named `uploads` at any depth — it silently excluded the new `src/modules/uploads/` source directory from git. Anchored to `apps/api/uploads/`. |
| `apps/api/.env.example` | Was missing three variables that `env.ts` actually requires (`EMAIL_HOST`, `EMAIL_USER`, `EMAIL_PASSWORD`). Following the README produced a startup crash naming a variable the README never mentioned. |
| `apps/api/tsconfig.json` | **ts-node defaults to `files: false`**, compiling only the entry import graph, so it never loaded `src/types/express.d.ts`. Harmless while every controller declared its own request type — but the new routers rely on the global augmentation, so `pnpm dev` would have failed while `tsc --noEmit` stayed green. Fixed with the `ts-node.files` option. Caught by running the real dev entrypoint, not by the type check. |
| `apps/web/pnpm-workspace.yaml` | pnpm 11 blocks esbuild's postinstall by default, so `vite build` failed on a clean install. Added esbuild to `allowBuilds`. |
| `apps/api/pnpm-lock.yaml` | Still carried `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner` and `razorpay`, none of them in `package.json`. Pruned. This is also the evidence that uploads were S3-based and payments went through Razorpay before both were dropped — which is why the frontend still speaks presigned-URL. |
| `README.md` | Contained a real-looking Supabase project ref. Replaced with a placeholder and a note to use your own project. |

---

## 4. Found and deliberately NOT fixed

A refactor must not silently change behaviour, so these are preserved exactly as they were,
with an explanatory comment at each site. They are documented in the README's Known Issues
so nobody re-files them. **Triaged — they are not equally urgent.**

### Broken now — these features do not work

- **F1 — Notices 404 for both roles.** `app.ts` mounts `noticesRouter` at
  `/owner/notices` *and* `/tenant/notices`, but the router's own paths are `/owner`,
  `/owner/:noticeId` and `/tenant`. So the real URLs are `/owner/notices/owner`, while the
  web app calls `/owner/notices`. Fix the mounts **or** the paths, not both.
  *Not an authorization hole* — every route carries its own role guard, which I verified.
- **F2 — `GET /buildings/search` is unreachable.** Registered *after* `/:buildingId`, which
  matches first. Move it above.
- **F3 — Tenants cannot search or view properties.**
  `buildingsRouter.use(authenticate, requireVerifiedOwner)` also covers `/search` and
  `/:buildingId/public`, which read as intended-public (the latter even adds
  `optionalAuth`). Move them to their own router or apply the guard per route.
- **F4 — Session expiry logs users out instead of refreshing.**
  `POST /auth/refresh-token` is a `501` stub, but the axios interceptor calls it on every
  401 and treats failure as "session over".
- **F5 — File uploads return 501.** Owner verification and Aadhaar upload cannot be
  completed. The frontend expects a presigned flow; the backend has local-disk config and
  no object-storage client.

F1–F3 are each a one-to-five-line fix. They are worth doing soon mainly because you will
otherwise hit them mid-feature and assume your own new code is at fault.

### Gate before real users — not work for today

- **F6 — `UPLOAD_DIR` is served by unauthenticated `express.static`** (`app.ts:51`). These
  are Aadhaar/PAN/selfie documents. Nothing is exposed today because uploads are 501, but
  **the upload flow must not ship until this is an authenticated route.**

### Genuinely later

- **F7 — `pnpm start` is broken.** `tsc` does not rewrite path aliases, so `dist/index.js`
  does `require("@config/env")` and crashes. Only affects production builds; `pnpm dev`
  works via `tsconfig-paths`. Fix with `tsc-alias` or by dropping the aliases.
- **F8 — `config/env.ts:54`** defaults `EMAIL_FROM` to a personal Gmail address.
- **F9 — No shared types.** `web/src/types/index.ts` (198 lines) mirrors the Prisma schema
  by hand and will drift.
- **F10 — No tests, no CI.**

---

## 5. Verification — and its limits

All four checks pass. **Every one of them was failing before this branch.**

| Check | Command | Result |
|---|---|---|
| API type check | `apps/api` → `pnpm lint` | pass |
| API build | `apps/api` → `pnpm build` | pass |
| Web lint | `apps/web` → `pnpm lint` | pass, **0 errors** (3 warnings, pre-existing) |
| Web build | `apps/web` → `pnpm build` | pass |
| API boots | real dev entrypoint | starts, all 15 routers register |
| HTTP probe | 11 endpoints across every refactored module | all expected codes |

HTTP probe detail — `/health` 200; `buildings`, `buildings/:id/floors`, `issues/my`,
`admin/owners/pending`, `payments/my`, `owner/dashboard/owner`, `owner/notices/owner`,
`bookings/my` all 401 without a cookie; `auth/send-otp` 422 on an empty body;
`auth/refresh-token` 501 with a body byte-identical to before; unknown path 404.

### What is NOT verified

Tests were skipped on request, so the gate was **type check + build + HTTP status probes**.
That proves nothing crashes, every route still registers, and the auth guards still fire.

It does **not** prove response bodies are unchanged under real data. Phase 3 touched the
HTTP layer of all 14 modules. Mitigations: no service file was modified; every message
string, status code and middleware order was copied verbatim; auth cookie handling is
identical.

**Two things need manual testing before merge:**

1. **The UPI payment flow** is wired correctly against the API's actual contracts, but I
   could not execute it — it needs a real database, a `CONFIRMED` booking, and an owner
   with a UPI ID. Intent URLs only open a UPI app on mobile. **Test on a phone.**
2. **A click-through of all 13 nav items** plus both auth flows, to confirm the flattened
   pages are wired to the routes they should be. I verified every moved file's exported
   component still matches its route name, but that is static checking.

---

## 6. README

Rewritten as an onboarding doc rather than a setup script, because the old one described a
Next.js app that no longer exists. It now covers:

- **Architecture** — the request path, why cookie auth couples `FRONTEND_URL` to CORS (a
  mismatch looks like a broken login, not a CORS error), the response envelope, and the
  warning that `web/src/types/index.ts` mirrors Prisma by hand
- **Repo structure** and **conventions** — how to add an endpoint (service →
  `asyncHandler` route → mount; no controller), how to add a page (`App.tsx` or it is
  unreachable; use `useRequiredParam`), and the `features/` rule
- **How payments work** — the full six-step UPI flow, with the UTR step called out
- **Known issues** — F1–F10, split by urgency, each with the actual fix
- **What changed in the cleanup** — the file moves, so anyone who knew the old tree can
  find things

---

## 7. Reviewer notes

- Read the commits in order; each is scoped to one concern and explains its reasoning.
  The Phase 3 commits are mechanical and near-identical — reviewing one or two carefully is
  worth more than skimming all seven.
- The large deletion count is dominated by `package-lock.json`, the two `refactor*.js`
  codemods, and the 14 controllers.
- `git log --follow <file>` works across the Phase 4 moves.
- **Suggested follow-ups, in order:** F1–F3 on their own branch (small, but each changes
  behaviour, so they don't belong in a cleanup PR) → a minimal test harness → the real
  uploads module, gated on F6.

## Answers to two questions a reviewer will have

**"Why keep `config/`, `middleware/`, `modules/`, `types/`, `utils/` if the goal was
simplification?"** Because the nesting was never the cost — it is two levels deep, and
flattening it would put 75 files in one directory. The cost was a redundant *layer* (14
controllers, 61 try/catch blocks, 16 duplicated types). Deleting the layer removed ~470
net lines and 14 files while leaving folder depth untouched.

**"Should this be JavaScript instead of TypeScript to simplify?"** No — TypeScript is
carrying this project. Prisma's whole value is its generated types across a 15-model
schema; Zod schemas already double as runtime validation and static types on both sides;
`tsc --noEmit` is the API's only automated check. In plain JS, the four bugs above that
were caught at compile time would instead have been runtime `undefined`s in production.

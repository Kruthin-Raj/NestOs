# NestOS - PG & Hostel Management System

NestOS is a comprehensive platform for managing PGs, hostels, and shared accommodations. It provides a seamless experience for both property owners and tenants.

## Tech Stack

- **Frontend**: React 19 + Vite, React Router 7, Tailwind CSS v4, TanStack Query,
  Zustand, react-hook-form + Zod, Leaflet (maps), Recharts
- **Backend**: Node.js, Express 5, Prisma 7 ORM, Zod validation, JWT in httpOnly cookies
- **Database**: PostgreSQL (hosted on Supabase)
- **Payments**: Direct UPI Intent (Zero fee)
- **File Storage**: Local disk — the upload endpoints are not implemented yet
  and currently return `501 Not Implemented`

## Getting Started

Follow these steps to set up and run the application locally.

### 1. Database Setup (Supabase)

We use Supabase for free PostgreSQL hosting.
1. Go to [supabase.com](https://supabase.com) and create a free account.
2. Click **"New Project"**, name it `nestos`, and create a strong database password. Choose a region close to you.
3. Wait a few minutes for the project to be provisioned.
4. Go to **Project Settings -> Database**.
5. Scroll down to **Connection string** and select **URI**. It will look something like this:
   `postgresql://postgres:[YOUR-PASSWORD]@db.aylmbapvbuabrlxsuwfd.supabase.co:5432/postgres`

### 2. Configure Environment Variables

The project requires environment variables for both the backend (API) and frontend (Web).

Each app ships a committed `.env.example` with placeholder values. Copy it and fill in
your own — never commit the filled-in file.

#### Backend (`apps/api/.env`)

```bash
cp apps/api/.env.example apps/api/.env
```

Then set `DATABASE_URL` to your own Supabase connection string (replace both
`<YOUR-PASSWORD>` and `<YOUR-PROJECT-REF>`), and generate your own JWT secrets —
for example with `openssl rand -hex 32`.

`FRONTEND_URL` must exactly match the origin the web app runs on, or CORS will
reject every request.

#### Frontend (`apps/web/.env.local`)

```bash
cp apps/web/.env.example apps/web/.env.local
```

Vite only exposes variables prefixed `VITE_`. A `NEXT_PUBLIC_*` variable will be
silently ignored, and the app will fall back to `http://localhost:4000/api/v1`.

### 3. Install Dependencies

Open your terminal (if you are on Windows PowerShell and get execution policy errors, run this as Administrator first: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`).

This repo uses **pnpm** (`apps/api` pins `pnpm@10.32.1` via `packageManager`).

Install backend dependencies:
```bash
cd apps/api
pnpm install
```

Install frontend dependencies:
```bash
cd ../web
pnpm install
```

### 4. Setup Database Schema (Prisma)

Navigate to the API folder and sync the database schema:

```bash
cd ../api
pnpm db:generate
pnpm db:push
```
*(Optional) To populate some initial data, you can run: `pnpm db:seed`*

Note that `prisma generate` reads `DATABASE_URL` from `.env`, so step 2 must be done
first — even though generating the client makes no database connection.

### 5. Start the Application

You need two separate terminal windows/tabs to run the backend and frontend simultaneously.

**Terminal 1 (Backend):**
```bash
cd apps/api
pnpm dev
```
*The API will start at http://localhost:4000*

**Terminal 2 (Frontend):**
```bash
cd apps/web
pnpm dev
```
*The Web app will start at http://localhost:3000*

### 6. Verify

Open your browser and navigate to `http://localhost:3000`. You should see the NestOS landing page!

## Project Structure

- `/apps/api`: Express backend, Prisma schema, and business logic. Each domain lives in
  `src/modules/<domain>/` as a router + service (+ validation) trio.
- `/apps/web`: React + Vite SPA. Routes are declared centrally in `src/App.tsx`.

## Collaboration

1. Create a repository on GitHub.
2. Initialize git in the root folder (`git init`).
3. Add files (`git add .`) and commit (`git commit -m "Initial commit"`).
4. Add remote (`git remote add origin <your-repo-url>`).
5. Push to GitHub (`git push -u origin main`).

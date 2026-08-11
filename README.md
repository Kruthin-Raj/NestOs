# NestOS - PG & Hostel Management System

NestOS is a comprehensive platform for managing PGs, hostels, and shared accommodations. It provides a seamless experience for both property owners and tenants.

## Tech Stack

- **Frontend**: Vite, React, Tailwind CSS, React Query, Zustand, Leaflet (Maps)
- **Backend**: Node.js, Express.js, Prisma ORM
- **Database**: PostgreSQL (hosted on Supabase)
- **Payments**: Direct UPI Intent (Zero fee)
- **File Storage**: Local File Storage

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

#### Backend (`apps/api/.env`)
Open `apps/api/.env` (or create it if it doesn't exist) and fill in your Supabase connection string. Replace `[YOUR-PASSWORD]` with your actual value.

```env
PORT=4000
NODE_ENV=development

# Database (Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.aylmbapvbuabrlxsuwfd.supabase.co:5432/postgres"

# JWT Secrets (Can be any random string for local dev)
JWT_ACCESS_SECRET=your_very_long_random_secret_here
JWT_REFRESH_SECRET=another_very_long_random_secret_here
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# File Storage
UPLOAD_DIR=uploads
FRONTEND_URL=http://localhost:3000
```

#### Frontend (`apps/web/.env.local`)
Open `apps/web/.env.local` (or create it if it doesn't exist).

```env
VITE_API_URL=http://localhost:4000/api/v1
VITE_APP_NAME=NestOS
VITE_APP_URL=http://localhost:3000
```

*Note: There is also a root `.env` file that can be used to set variables globally.*

### 3. Install Dependencies

Open your terminal (if you are on Windows PowerShell and get execution policy errors, run this as Administrator first: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force`).

Install backend dependencies:
```bash
cd apps/api
npm install
```

Install frontend dependencies:
```bash
cd ../web
npm install
```

### 4. Setup Database Schema (Prisma)

Navigate to the API folder and sync the database schema:

```bash
cd ../api
npx prisma generate
npx prisma db push
```
*(Optional) To populate some initial data, you can run: `npm run db:seed`*

### 5. Start the Application

You need two separate terminal windows/tabs to run the backend and frontend simultaneously.

**Terminal 1 (Backend):**
```bash
cd apps/api
npm run dev
```
*The API will start at http://localhost:4000*

**Terminal 2 (Frontend):**
```bash
cd apps/web
npm run dev
```
*The Web app will start instantly at http://localhost:3000 (Vite is incredibly fast!)*

### 6. Verify

Open your browser and navigate to `http://localhost:3000`. You should see the NestOS landing page!

## Project Structure

- `/apps/api`: Node.js Express backend, Prisma schema, and business logic.
- `/apps/web`: Vite React frontend, components, and UI pages.

## Collaboration

1. Create a repository on GitHub.
2. Initialize git in the root folder (`git init`).
3. Add files (`git add .`) and commit (`git commit -m "Initial commit"`).
4. Add remote (`git remote add origin <your-repo-url>`).
5. Push to GitHub (`git push -u origin main`).

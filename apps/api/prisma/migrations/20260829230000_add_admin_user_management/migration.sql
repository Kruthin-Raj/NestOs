-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'DEACTIVATED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "RejectionType" AS ENUM ('OWNER_VERIFICATION', 'TENANT_IDENTITY');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'USER_STATUS_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_ROLE_CHANGED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_BLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_UNBLOCKED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DEACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE 'USER_DELETED';

-- AlterTable: Add new columns
ALTER TABLE "users"
ADD COLUMN "rejectionCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "statusReason" TEXT,
ADD COLUMN "statusUpdatedAt" TIMESTAMP(3),
ADD COLUMN "statusUpdatedBy" TEXT,
ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 1;

-- CRITICAL DATA BACKFILL: Preserve previously deactivated users
UPDATE "users" SET "status" = 'DEACTIVATED' WHERE "isActive" = false;

-- Drop old column after backfill
ALTER TABLE "users" DROP COLUMN "isActive";

-- CreateTable
CREATE TABLE "user_rejections" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetType" "RejectionType" NOT NULL,
    "reason" TEXT NOT NULL,
    "adminId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_rejections_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_rejections_userId_idx" ON "user_rejections"("userId");
CREATE INDEX "user_rejections_createdAt_idx" ON "user_rejections"("createdAt");
CREATE INDEX "users_status_idx" ON "users"("status");

-- AddForeignKey
ALTER TABLE "user_rejections" ADD CONSTRAINT "user_rejections_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

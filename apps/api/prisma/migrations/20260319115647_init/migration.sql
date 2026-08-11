-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'OWNER', 'TENANT');

-- CreateEnum
CREATE TYPE "OwnerVerificationStatus" AS ENUM ('PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BuildingType" AS ENUM ('PG', 'HOSTEL', 'APARTMENT', 'SHARED_FLAT');

-- CreateEnum
CREATE TYPE "GenderPreference" AS ENUM ('MALE', 'FEMALE', 'CO_ED');

-- CreateEnum
CREATE TYPE "BuildingStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'UNDER_REVIEW');

-- CreateEnum
CREATE TYPE "RoomType" AS ENUM ('PRIVATE', 'SHARED', 'DORMITORY');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('VACANT', 'RESERVED', 'OCCUPIED', 'BLOCKED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('BOOKING_DEPOSIT', 'SECURITY_DEPOSIT', 'RENT', 'PENALTY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "IssuePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "IssueStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'REJECTED', 'REOPENED');

-- CreateEnum
CREATE TYPE "IssueCategory" AS ENUM ('MAINTENANCE', 'PLUMBING', 'ELECTRICAL', 'CLEANLINESS', 'SECURITY', 'WIFI', 'APPLIANCE', 'NOISE', 'OTHER');

-- CreateEnum
CREATE TYPE "IssueCommentAuthorRole" AS ENUM ('TENANT', 'OWNER');

-- CreateEnum
CREATE TYPE "NoticeTargetType" AS ENUM ('ALL_BUILDINGS', 'BUILDING', 'FLOOR', 'ROOM', 'TENANT');

-- CreateEnum
CREATE TYPE "NoticeCategory" AS ENUM ('MAINTENANCE', 'SECURITY', 'RENT_REMINDER', 'VISITOR', 'DELIVERY', 'RULE_REMINDER', 'GENERAL');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('AADHAAR_FRONT', 'AADHAAR_BACK', 'PAN_CARD', 'PASSPORT', 'DRIVING_LICENCE', 'VOTER_ID', 'PROPERTY_DEED', 'LEASE_AGREEMENT', 'UTILITY_BILL', 'PROPERTY_TAX', 'SELFIE', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('ONBOARDING', 'SEARCHING', 'RESERVED', 'ACTIVE', 'MOVED_OUT');

-- CreateEnum
CREATE TYPE "RentCycle" AS ENUM ('MONTHLY');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('USER_CREATED', 'USER_LOGIN', 'OWNER_VERIFIED', 'OWNER_REJECTED', 'BUILDING_CREATED', 'BED_STATUS_CHANGED', 'BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'ISSUE_CREATED', 'ISSUE_STATUS_CHANGED', 'NOTICE_CREATED', 'DOCUMENT_UPLOADED', 'DOCUMENT_VERIFIED', 'TENANT_MOVED_IN', 'TENANT_MOVED_OUT');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "role" "UserRole" NOT NULL,
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "businessName" TEXT,
    "verificationStatus" "OwnerVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verificationNotes" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "selfieUrl" TEXT,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_documents" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "phone" TEXT,
    "profession" TEXT,
    "employerOrCollege" TEXT,
    "city" TEXT,
    "status" "TenantStatus" NOT NULL DEFAULT 'ONBOARDING',
    "profileCompletion" INTEGER NOT NULL DEFAULT 0,
    "aadhaarNumber" TEXT,
    "isIdVerified" BOOLEAN NOT NULL DEFAULT false,
    "idVerifiedAt" TIMESTAMP(3),
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "emergencyRelation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_preferences" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "smoking" TEXT,
    "drinking" TEXT,
    "foodPreference" TEXT,
    "sleepSchedule" TEXT,
    "workSchedule" TEXT,
    "cleanlinessLevel" TEXT,
    "noiseLevel" TEXT,
    "guestsAllowed" TEXT,
    "petsAllowed" BOOLEAN,
    "preferredGender" TEXT,
    "preferredSmoking" TEXT,
    "preferredFoodPref" TEXT,
    "preferredSleepSchedule" TEXT,
    "preferredCleanliness" TEXT,
    "personalIcks" TEXT,
    "compatibilityBio" VARCHAR(500),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_documents" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT,
    "fileSizeBytes" INTEGER,
    "mimeType" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buildings" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "BuildingType" NOT NULL,
    "status" "BuildingStatus" NOT NULL DEFAULT 'DRAFT',
    "genderPreference" "GenderPreference" NOT NULL DEFAULT 'CO_ED',
    "addressLine1" TEXT NOT NULL,
    "addressLine2" TEXT,
    "landmark" TEXT,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "latitude" DECIMAL(10,7),
    "longitude" DECIMAL(10,7),
    "totalFloors" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "rules" TEXT,
    "depositMonths" INTEGER NOT NULL DEFAULT 2,
    "depositFixed" DECIMAL(12,2),
    "rentCycle" "RentCycle" NOT NULL DEFAULT 'MONTHLY',
    "rentDueDay" INTEGER NOT NULL DEFAULT 1,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "totalBeds" INTEGER NOT NULL DEFAULT 0,
    "occupiedBeds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "buildings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_amenities" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "building_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "building_photos" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "building_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "floors" (
    "id" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "floorNumber" INTEGER NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "floors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "type" "RoomType" NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 1,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "baseRent" DECIMAL(12,2) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "room_amenities" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "room_amenities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "bedLabel" TEXT NOT NULL,
    "status" "BedStatus" NOT NULL DEFAULT 'VACANT',
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "currentTenantId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "bedId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "moveInDate" TIMESTAMP(3) NOT NULL,
    "moveOutDate" TIMESTAMP(3),
    "actualMoveOutDate" TIMESTAMP(3),
    "monthlyRent" DECIMAL(12,2) NOT NULL,
    "depositAmount" DECIMAL(12,2) NOT NULL,
    "depositPaid" BOOLEAN NOT NULL DEFAULT false,
    "depositRefunded" BOOLEAN NOT NULL DEFAULT false,
    "depositRefundedAt" TIMESTAMP(3),
    "razorpayOrderId" TEXT,
    "razorpayPaymentId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountRupees" DECIMAL(12,2) NOT NULL,
    "billingMonth" INTEGER,
    "billingYear" INTEGER,
    "razorpayOrderId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "razorpaySignature" TEXT,
    "webhookReceivedAt" TIMESTAMP(3),
    "webhookPayload" JSONB,
    "failureReason" TEXT,
    "failedAt" TIMESTAMP(3),
    "receiptNumber" TEXT,
    "receiptUrl" TEXT,
    "refundedAt" TIMESTAMP(3),
    "refundAmount" DECIMAL(12,2),
    "refundRazorpayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "buildingId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "roomId" TEXT,
    "bedId" TEXT,
    "category" "IssueCategory" NOT NULL,
    "priority" "IssuePriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "IssueStatus" NOT NULL DEFAULT 'OPEN',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "photoUrls" TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "rejectedAt" TIMESTAMP(3),
    "rejectedBy" TEXT,
    "rejectionReason" TEXT,
    "reopenedAt" TIMESTAMP(3),
    "reopenDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_comments" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" "IssueCommentAuthorRole" NOT NULL,
    "body" TEXT NOT NULL,
    "photoUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "issue_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notices" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" "NoticeCategory" NOT NULL DEFAULT 'GENERAL',
    "targetType" "NoticeTargetType" NOT NULL,
    "targetBuildingId" TEXT,
    "targetFloorId" TEXT,
    "targetRoomId" TEXT,
    "targetTenantId" TEXT,
    "publishAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "sendEmail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notice_reads" (
    "id" TEXT NOT NULL,
    "noticeId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notice_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "actorRole" "UserRole",
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "otp_codes_identifier_idx" ON "otp_codes"("identifier");

-- CreateIndex
CREATE INDEX "otp_codes_expiresAt_idx" ON "otp_codes"("expiresAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_profiles_userId_key" ON "owner_profiles"("userId");

-- CreateIndex
CREATE INDEX "owner_profiles_userId_idx" ON "owner_profiles"("userId");

-- CreateIndex
CREATE INDEX "owner_profiles_verificationStatus_idx" ON "owner_profiles"("verificationStatus");

-- CreateIndex
CREATE INDEX "owner_documents_ownerId_idx" ON "owner_documents"("ownerId");

-- CreateIndex
CREATE INDEX "owner_documents_status_idx" ON "owner_documents"("status");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_profiles_userId_key" ON "tenant_profiles"("userId");

-- CreateIndex
CREATE INDEX "tenant_profiles_userId_idx" ON "tenant_profiles"("userId");

-- CreateIndex
CREATE INDEX "tenant_profiles_status_idx" ON "tenant_profiles"("status");

-- CreateIndex
CREATE INDEX "tenant_profiles_gender_idx" ON "tenant_profiles"("gender");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_preferences_tenantId_key" ON "tenant_preferences"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_documents_tenantId_idx" ON "tenant_documents"("tenantId");

-- CreateIndex
CREATE INDEX "buildings_ownerId_idx" ON "buildings"("ownerId");

-- CreateIndex
CREATE INDEX "buildings_city_idx" ON "buildings"("city");

-- CreateIndex
CREATE INDEX "buildings_status_idx" ON "buildings"("status");

-- CreateIndex
CREATE INDEX "buildings_latitude_longitude_idx" ON "buildings"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "building_amenities_buildingId_idx" ON "building_amenities"("buildingId");

-- CreateIndex
CREATE INDEX "building_photos_buildingId_idx" ON "building_photos"("buildingId");

-- CreateIndex
CREATE INDEX "floors_buildingId_idx" ON "floors"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "floors_buildingId_floorNumber_key" ON "floors"("buildingId", "floorNumber");

-- CreateIndex
CREATE INDEX "rooms_floorId_idx" ON "rooms"("floorId");

-- CreateIndex
CREATE INDEX "rooms_buildingId_idx" ON "rooms"("buildingId");

-- CreateIndex
CREATE UNIQUE INDEX "rooms_buildingId_roomNumber_key" ON "rooms"("buildingId", "roomNumber");

-- CreateIndex
CREATE INDEX "room_amenities_roomId_idx" ON "room_amenities"("roomId");

-- CreateIndex
CREATE INDEX "beds_roomId_idx" ON "beds"("roomId");

-- CreateIndex
CREATE INDEX "beds_buildingId_idx" ON "beds"("buildingId");

-- CreateIndex
CREATE INDEX "beds_status_idx" ON "beds"("status");

-- CreateIndex
CREATE INDEX "beds_currentTenantId_idx" ON "beds"("currentTenantId");

-- CreateIndex
CREATE UNIQUE INDEX "beds_roomId_bedLabel_key" ON "beds"("roomId", "bedLabel");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_razorpayOrderId_key" ON "bookings"("razorpayOrderId");

-- CreateIndex
CREATE INDEX "bookings_tenantId_idx" ON "bookings"("tenantId");

-- CreateIndex
CREATE INDEX "bookings_bedId_idx" ON "bookings"("bedId");

-- CreateIndex
CREATE INDEX "bookings_buildingId_idx" ON "bookings"("buildingId");

-- CreateIndex
CREATE INDEX "bookings_ownerId_idx" ON "bookings"("ownerId");

-- CreateIndex
CREATE INDEX "bookings_status_idx" ON "bookings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpayOrderId_key" ON "payments"("razorpayOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_razorpayPaymentId_key" ON "payments"("razorpayPaymentId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_receiptNumber_key" ON "payments"("receiptNumber");

-- CreateIndex
CREATE INDEX "payments_bookingId_idx" ON "payments"("bookingId");

-- CreateIndex
CREATE INDEX "payments_tenantId_idx" ON "payments"("tenantId");

-- CreateIndex
CREATE INDEX "payments_ownerId_idx" ON "payments"("ownerId");

-- CreateIndex
CREATE INDEX "payments_status_idx" ON "payments"("status");

-- CreateIndex
CREATE INDEX "payments_type_idx" ON "payments"("type");

-- CreateIndex
CREATE INDEX "payments_billingYear_billingMonth_idx" ON "payments"("billingYear", "billingMonth");

-- CreateIndex
CREATE INDEX "issues_tenantId_idx" ON "issues"("tenantId");

-- CreateIndex
CREATE INDEX "issues_buildingId_idx" ON "issues"("buildingId");

-- CreateIndex
CREATE INDEX "issues_ownerId_idx" ON "issues"("ownerId");

-- CreateIndex
CREATE INDEX "issues_status_idx" ON "issues"("status");

-- CreateIndex
CREATE INDEX "issues_priority_idx" ON "issues"("priority");

-- CreateIndex
CREATE INDEX "issue_comments_issueId_idx" ON "issue_comments"("issueId");

-- CreateIndex
CREATE INDEX "notices_ownerId_idx" ON "notices"("ownerId");

-- CreateIndex
CREATE INDEX "notices_targetType_idx" ON "notices"("targetType");

-- CreateIndex
CREATE INDEX "notices_targetBuildingId_idx" ON "notices"("targetBuildingId");

-- CreateIndex
CREATE INDEX "notices_publishAt_idx" ON "notices"("publishAt");

-- CreateIndex
CREATE INDEX "notice_reads_tenantId_idx" ON "notice_reads"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "notice_reads_noticeId_tenantId_key" ON "notice_reads"("noticeId", "tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_profiles" ADD CONSTRAINT "owner_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_documents" ADD CONSTRAINT "owner_documents_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_preferences" ADD CONSTRAINT "tenant_preferences_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_documents" ADD CONSTRAINT "tenant_documents_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buildings" ADD CONSTRAINT "buildings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_amenities" ADD CONSTRAINT "building_amenities_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "building_photos" ADD CONSTRAINT "building_photos_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "floors" ADD CONSTRAINT "floors_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "floors"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "room_amenities" ADD CONSTRAINT "room_amenities_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_currentTenantId_fkey" FOREIGN KEY ("currentTenantId") REFERENCES "tenant_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "buildings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_bedId_fkey" FOREIGN KEY ("bedId") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_comments" ADD CONSTRAINT "issue_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "owner_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_targetBuildingId_fkey" FOREIGN KEY ("targetBuildingId") REFERENCES "buildings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_targetFloorId_fkey" FOREIGN KEY ("targetFloorId") REFERENCES "floors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_targetRoomId_fkey" FOREIGN KEY ("targetRoomId") REFERENCES "rooms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notices" ADD CONSTRAINT "notices_targetTenantId_fkey" FOREIGN KEY ("targetTenantId") REFERENCES "tenant_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notice_reads" ADD CONSTRAINT "notice_reads_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenant_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

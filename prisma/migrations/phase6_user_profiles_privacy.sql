-- Phase 6: User Profiles & Privacy (HIPAA-Compliant)
-- This migration adds user profile, privacy settings, consent logging, and audit logging

-- Create enum types
CREATE TYPE "ConsentType" AS ENUM ('TERMS_OF_SERVICE', 'PRIVACY_POLICY', 'RESEARCH_SHARING', 'MARKETING_EMAILS');
CREATE TYPE "PrivacyLevel" AS ENUM ('PUBLIC', 'PRIVATE', 'RESEARCH_ONLY');

-- User table extension with PII and privacy fields
ALTER TABLE "User" ADD COLUMN "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN "lastName" TEXT;
ALTER TABLE "User" ADD COLUMN "dateOfBirth" TEXT; -- Encrypted at rest
ALTER TABLE "User" ADD COLUMN "phone" TEXT; -- Encrypted at rest
ALTER TABLE "User" ADD COLUMN "preferences" JSONB DEFAULT '{}';
ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP; -- Soft delete
ALTER TABLE "User" ADD COLUMN "hardDeleteAt" TIMESTAMP; -- Scheduled hard delete (30 days)

-- Create indexes for faster queries
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");

-- UserProfile table: Extended profile information
CREATE TABLE "UserProfile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "bio" TEXT,
  "avatar" TEXT,
  "privacyLevel" "PrivacyLevel" NOT NULL DEFAULT 'PRIVATE',
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL,
  CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");

-- PrivacySettings table: User privacy preferences
CREATE TABLE "PrivacySettings" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL UNIQUE,
  "dataCollectionOptIn" BOOLEAN NOT NULL DEFAULT true,
  "shareWithResearch" BOOLEAN NOT NULL DEFAULT false,
  "marketingEmails" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL,
  CONSTRAINT "PrivacySettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "PrivacySettings_userId_idx" ON "PrivacySettings"("userId");

-- ConsentLog table: Track all consent records for compliance
CREATE TABLE "ConsentLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "consentType" "ConsentType" NOT NULL,
  "version" TEXT NOT NULL,
  "consented" BOOLEAN NOT NULL,
  "ipAddress" TEXT, -- Anonymized (last octet = 0)
  "userAgent" TEXT,
  "givenAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ConsentLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "ConsentLog_userId_consentType_idx" ON "ConsentLog"("userId", "consentType");
CREATE INDEX "ConsentLog_givenAt_idx" ON "ConsentLog"("givenAt");

-- AuditLog table: HIPAA-compliant append-only audit trail
-- All data access, modifications, and deletions are logged
CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "action" TEXT NOT NULL, -- DATA_ACCESS, DATA_MODIFICATION, PROFILE_UPDATE, EXPORT, DELETE, SESSION_*
  "resourceType" TEXT NOT NULL, -- profile, email, phone, chat_history, account, etc.
  "oldValue" TEXT, -- Hashed if sensitive
  "newValue" TEXT, -- Hashed if sensitive
  "performedBy" TEXT NOT NULL, -- User email or "SYSTEM"
  "ipAddress" TEXT, -- Anonymized
  "userAgent" TEXT,
  "reason" TEXT,
  "status" TEXT NOT NULL DEFAULT 'SUCCESS',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

-- Append-only: no updates or deletes allowed on AuditLog (enforce via application)
CREATE INDEX "AuditLog_userId_action_idx" ON "AuditLog"("userId", "action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_performedBy_idx" ON "AuditLog"("performedBy");

-- AuthSession table: Multi-device session management (Phase 7)
CREATE TABLE "AuthSession" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "deviceName" TEXT, -- e.g., "Chrome on Windows"
  "deviceType" TEXT, -- "desktop", "mobile", "tablet"
  "country" TEXT, -- Anonymized country
  "city" TEXT, -- Anonymized city
  "ipAddress" TEXT, -- Anonymized
  "lastActivityAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP NOT NULL,
  "isRevoked" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL,
  CONSTRAINT "AuthSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "AuthSession_userId_idx" ON "AuthSession"("userId");
CREATE INDEX "AuthSession_expiresAt_idx" ON "AuthSession"("expiresAt");
CREATE INDEX "AuthSession_isRevoked_idx" ON "AuthSession"("isRevoked");

-- Add AuthMethod enum to User (for future auth phase)
-- CREATE TYPE "AuthMethod" AS ENUM ('EMAIL', 'GOOGLE', 'GITHUB');
-- ALTER TABLE "User" ADD COLUMN "authMethod" "AuthMethod" NOT NULL DEFAULT 'EMAIL';

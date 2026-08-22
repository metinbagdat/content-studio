-- CreateEnum
CREATE TYPE "ReviewBulkAction" AS ENUM ('APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "ReviewBulkStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "ReviewBulkJob" (
    "id" TEXT NOT NULL,
    "action" "ReviewBulkAction" NOT NULL,
    "status" "ReviewBulkStatus" NOT NULL DEFAULT 'PENDING',
    "itemIds" TEXT[],
    "cursor" INTEGER NOT NULL DEFAULT 0,
    "autoMedia" BOOLEAN NOT NULL DEFAULT false,
    "autoWpDraft" BOOLEAN NOT NULL DEFAULT false,
    "scopeFilter" TEXT NOT NULL DEFAULT 'ALL',
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "approvedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "draftsCount" INTEGER NOT NULL DEFAULT 0,
    "mediaCount" INTEGER NOT NULL DEFAULT 0,
    "wpDraftCount" INTEGER NOT NULL DEFAULT 0,
    "currentLabel" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReviewBulkJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReviewBulkJob_status_idx" ON "ReviewBulkJob"("status");

-- CreateIndex
CREATE INDEX "ReviewBulkJob_createdAt_idx" ON "ReviewBulkJob"("createdAt");

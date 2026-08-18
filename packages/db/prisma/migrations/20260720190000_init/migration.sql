-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('VIDEO_SCRIPT', 'PODCAST_SCRIPT', 'MARCH_LYRICS', 'SONG_LYRICS', 'SOCIAL_CAPTION', 'BLOG_POST');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('VIDEO', 'AUDIO', 'IMAGE');

-- CreateEnum
CREATE TYPE "ProcessingStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PipelineStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('TIKTOK', 'TWITTER', 'LINKEDIN', 'YOUTUBE', 'FACEBOOK', 'INSTAGRAM');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('GENERATE_VIDEO_SCRIPT', 'GENERATE_PODCAST_SCRIPT', 'GENERATE_MARCH_LYRICS', 'GENERATE_SONG_LYRICS', 'GENERATE_SOCIAL_CAPTION', 'GENERATE_BLOG_POST', 'CREATE_VIDEO', 'CREATE_PODCAST', 'UPLOAD_TO_PLATFORM', 'PUBLISH_SOCIAL_POST', 'SYNC_ANALYTICS', 'PROCESS_PIPELINE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'RETRY');

-- CreateTable
CREATE TABLE "ContentSource" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContentSource_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DerivedContent" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "contentType" "ContentType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "status" "ContentStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DerivedContent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MediaFile" (
    "id" TEXT NOT NULL,
    "derivedContentId" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "duration" INTEGER,
    "fileSize" INTEGER,
    "format" TEXT NOT NULL,
    "processingStatus" "ProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MediaFile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContentPipeline" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "PipelineStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "totalSteps" INTEGER NOT NULL DEFAULT 5,
    "config" JSONB NOT NULL,
    "errors" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContentPipeline_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialMediaAccount" (
    "id" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "config" JSONB,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SocialMediaAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SocialMediaPost" (
    "id" TEXT NOT NULL,
    "derivedContentId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "postContent" TEXT NOT NULL,
    "mediaUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "platformPostId" TEXT,
    "status" "PostStatus" NOT NULL DEFAULT 'DRAFT',
    "metrics" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SocialMediaPost_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "QueueJob" (
    "id" TEXT NOT NULL,
    "jobType" "JobType" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "priority" INTEGER NOT NULL DEFAULT 5,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QueueJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContentSource_category_idx" ON "ContentSource"("category");
CREATE INDEX "ContentSource_createdAt_idx" ON "ContentSource"("createdAt");
CREATE INDEX "DerivedContent_sourceId_idx" ON "DerivedContent"("sourceId");
CREATE INDEX "DerivedContent_contentType_idx" ON "DerivedContent"("contentType");
CREATE INDEX "DerivedContent_status_idx" ON "DerivedContent"("status");
CREATE INDEX "MediaFile_derivedContentId_idx" ON "MediaFile"("derivedContentId");
CREATE INDEX "MediaFile_mediaType_idx" ON "MediaFile"("mediaType");
CREATE INDEX "ContentPipeline_sourceId_idx" ON "ContentPipeline"("sourceId");
CREATE INDEX "ContentPipeline_status_idx" ON "ContentPipeline"("status");
CREATE INDEX "SocialMediaAccount_platform_idx" ON "SocialMediaAccount"("platform");
CREATE INDEX "SocialMediaAccount_isActive_idx" ON "SocialMediaAccount"("isActive");
CREATE UNIQUE INDEX "SocialMediaAccount_platform_accountId_key" ON "SocialMediaAccount"("platform", "accountId");
CREATE INDEX "SocialMediaPost_derivedContentId_idx" ON "SocialMediaPost"("derivedContentId");
CREATE INDEX "SocialMediaPost_accountId_idx" ON "SocialMediaPost"("accountId");
CREATE INDEX "SocialMediaPost_status_idx" ON "SocialMediaPost"("status");
CREATE INDEX "SocialMediaPost_scheduledAt_idx" ON "SocialMediaPost"("scheduledAt");
CREATE INDEX "QueueJob_status_idx" ON "QueueJob"("status");
CREATE INDEX "QueueJob_jobType_idx" ON "QueueJob"("jobType");
CREATE INDEX "QueueJob_scheduledAt_idx" ON "QueueJob"("scheduledAt");

ALTER TABLE "DerivedContent" ADD CONSTRAINT "DerivedContent_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MediaFile" ADD CONSTRAINT "MediaFile_derivedContentId_fkey" FOREIGN KEY ("derivedContentId") REFERENCES "DerivedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContentPipeline" ADD CONSTRAINT "ContentPipeline_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ContentSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMediaPost" ADD CONSTRAINT "SocialMediaPost_derivedContentId_fkey" FOREIGN KEY ("derivedContentId") REFERENCES "DerivedContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SocialMediaPost" ADD CONSTRAINT "SocialMediaPost_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialMediaAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

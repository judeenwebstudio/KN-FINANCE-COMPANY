-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DocumentCategory') THEN
        CREATE TYPE "DocumentCategory" AS ENUM ('IDENTITY', 'ADDRESS_PROOF', 'OTHER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CustomFieldType') THEN
        CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'BOOLEAN', 'SELECT');
    END IF;
END $$;

-- AlterTable
ALTER TABLE "MemberProfile" ADD COLUMN IF NOT EXISTS "photoStorageKey" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberDocument" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "category" "DocumentCategory" NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberCustomFieldDefinition" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" "CustomFieldType" NOT NULL,
    "optionsJson" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MemberCustomFieldValue" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "fieldDefinitionId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MemberCustomFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "referenceUrl" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MemberCustomFieldDefinition_key_key" ON "MemberCustomFieldDefinition"("key");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MemberCustomFieldValue_memberId_fieldDefinitionId_key" ON "MemberCustomFieldValue"("memberId", "fieldDefinitionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MemberDocument_memberId_idx" ON "MemberDocument"("memberId");
CREATE INDEX IF NOT EXISTS "MemberDocument_category_idx" ON "MemberDocument"("category");
CREATE INDEX IF NOT EXISTS "MemberCustomFieldDefinition_active_displayOrder_idx" ON "MemberCustomFieldDefinition"("active", "displayOrder");
CREATE INDEX IF NOT EXISTS "MemberCustomFieldValue_memberId_idx" ON "MemberCustomFieldValue"("memberId");
CREATE INDEX IF NOT EXISTS "MemberCustomFieldValue_fieldDefinitionId_idx" ON "MemberCustomFieldValue"("fieldDefinitionId");
CREATE INDEX IF NOT EXISTS "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");
CREATE INDEX IF NOT EXISTS "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'MemberProfile') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberDocument_memberId_fkey') THEN
        ALTER TABLE "MemberDocument" ADD CONSTRAINT "MemberDocument_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'User') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberDocument_uploadedById_fkey') THEN
        ALTER TABLE "MemberDocument" ADD CONSTRAINT "MemberDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'User') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberCustomFieldDefinition_createdById_fkey') THEN
        ALTER TABLE "MemberCustomFieldDefinition" ADD CONSTRAINT "MemberCustomFieldDefinition_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'MemberProfile') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberCustomFieldValue_memberId_fkey') THEN
        ALTER TABLE "MemberCustomFieldValue" ADD CONSTRAINT "MemberCustomFieldValue_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "MemberProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'MemberCustomFieldDefinition') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MemberCustomFieldValue_fieldDefinitionId_fkey') THEN
        ALTER TABLE "MemberCustomFieldValue" ADD CONSTRAINT "MemberCustomFieldValue_fieldDefinitionId_fkey" FOREIGN KEY ("fieldDefinitionId") REFERENCES "MemberCustomFieldDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'User') AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_userId_fkey') THEN
        ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

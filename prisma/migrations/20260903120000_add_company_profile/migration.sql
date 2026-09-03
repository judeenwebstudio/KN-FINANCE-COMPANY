-- CreateTable
CREATE TABLE "CompanyProfile" (
    "id" TEXT NOT NULL DEFAULT 'company-profile-main',
    "legalName" TEXT,
    "displayName" TEXT NOT NULL DEFAULT 'KN Finance Company',
    "tagline" TEXT DEFAULT 'Empowering your future',
    "registrationNumber" TEXT,
    "taxId" TEXT,
    "licenseNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "country" TEXT,
    "timezone" TEXT DEFAULT 'UTC',
    "dateFormat" TEXT NOT NULL DEFAULT 'YYYY-MM-DD',
    "timeFormat" TEXT NOT NULL DEFAULT '12h',
    "locale" TEXT NOT NULL DEFAULT 'en-US',
    "logoUrl" TEXT DEFAULT '/branding/kn-finance-logo.png',
    "faviconUrl" TEXT DEFAULT '/favicon.ico',
    "metaDescription" TEXT DEFAULT 'KN Finance Company — Empowering your future. Multi-branch credit and loan management platform.',
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "CompanyProfile" ADD CONSTRAINT "CompanyProfile_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

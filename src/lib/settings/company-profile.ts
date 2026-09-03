import { prisma } from "../prisma";
import { logAuditEvent } from "../audit/audit-logger";
import { z } from "zod";

export const updateCompanyProfileSchema = z.object({
  legalName: z.string().trim().nullable().optional(),
  displayName: z.string().trim().min(1, "Display Name is required").max(100),
  tagline: z.string().trim().nullable().optional(),
  registrationNumber: z.string().trim().nullable().optional(),
  taxId: z.string().trim().nullable().optional(),
  licenseNumber: z.string().trim().nullable().optional(),
  email: z.string().trim().email("Invalid email address").nullable().or(z.literal("")).optional(),
  phone: z.string().trim().nullable().optional(),
  website: z.string().trim().url("Invalid website URL").nullable().or(z.literal("")).optional(),
  address: z.string().trim().nullable().optional(),
  city: z.string().trim().nullable().optional(),
  state: z.string().trim().nullable().optional(),
  country: z.string().trim().nullable().optional(),
  timezone: z.string().trim().nullable().optional(),
  dateFormat: z.string().trim().min(1, "Date format is required").optional(),
  timeFormat: z.string().trim().min(1, "Time format is required").optional(),
  locale: z.string().trim().min(1, "Locale is required").optional(),
  logoUrl: z.string().trim().nullable().optional(),
  faviconUrl: z.string().trim().nullable().optional(),
  metaDescription: z.string().trim().nullable().optional(),
});

export type UpdateCompanyProfileInput = z.infer<typeof updateCompanyProfileSchema>;

export const DEFAULT_COMPANY_PROFILE = {
  id: "company-profile-main",
  legalName: null,
  displayName: "KN Finance Company",
  tagline: "Empowering your future",
  registrationNumber: null,
  taxId: null,
  licenseNumber: null,
  email: null,
  phone: null,
  website: null,
  address: null,
  city: null,
  state: null,
  country: null,
  timezone: "UTC",
  dateFormat: "YYYY-MM-DD",
  timeFormat: "12h",
  locale: "en-US",
  logoUrl: "/branding/kn-finance-logo.png",
  faviconUrl: "/favicon.ico",
  metaDescription: "KN Finance Company — Empowering your future. Multi-branch credit and loan management platform.",
};

/**
 * Retrieves the current CompanyProfile singleton record.
 * Ensures initial default record with official KN Finance branding if missing.
 */
export async function getCompanyProfile() {
  const profile = await prisma.companyProfile.findUnique({
    where: { id: "company-profile-main" },
  });

  if (profile) return profile;

  // Initialize singleton if missing
  return await prisma.companyProfile.upsert({
    where: { id: "company-profile-main" },
    update: {},
    create: DEFAULT_COMPANY_PROFILE,
  });
}

/**
 * Atomically updates the CompanyProfile record and logs audit event.
 */
export async function updateCompanyProfile(actorUserId: string, input: UpdateCompanyProfileInput) {
  const validated = updateCompanyProfileSchema.parse(input);

  const cleanData = {
    legalName: validated.legalName || null,
    displayName: validated.displayName,
    tagline: validated.tagline || null,
    registrationNumber: validated.registrationNumber || null,
    taxId: validated.taxId || null,
    licenseNumber: validated.licenseNumber || null,
    email: validated.email || null,
    phone: validated.phone || null,
    website: validated.website || null,
    address: validated.address || null,
    city: validated.city || null,
    state: validated.state || null,
    country: validated.country || null,
    timezone: validated.timezone || "UTC",
    dateFormat: validated.dateFormat || "YYYY-MM-DD",
    timeFormat: validated.timeFormat || "12h",
    locale: validated.locale || "en-US",
    logoUrl: validated.logoUrl || "/branding/kn-finance-logo.png",
    faviconUrl: validated.faviconUrl || "/favicon.ico",
    metaDescription: validated.metaDescription || null,
    updatedById: actorUserId,
  };

  const updatedProfile = await prisma.companyProfile.upsert({
    where: { id: "company-profile-main" },
    update: cleanData,
    create: {
      id: "company-profile-main",
      ...cleanData,
    },
  });

  await logAuditEvent({
    actorUserId,
    action: "company_profile.update",
    entityType: "CompanyProfile",
    entityId: updatedProfile.id,
    metadata: {
      displayName: updatedProfile.displayName,
      legalName: updatedProfile.legalName,
      timezone: updatedProfile.timezone,
      dateFormat: updatedProfile.dateFormat,
    },
  });

  return updatedProfile;
}

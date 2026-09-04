import { isStorageConfigured } from "../storage/private-file-storage";
import { getEmailProviderStatus } from "./email-service";

export type IntegrationStatusDTO = {
  storage: { provider: "Vercel Blob"; mode: "Private"; configured: boolean; region: string };
  email: { provider: "None"; configured: false; detail: string };
  sms: { provider: "None"; configured: false; detail: string };
  runtimeNotifications: { provider: "Database-backed in-app notifications"; configured: true; detail: string };
  payments: { provider: "None"; configured: false; detail: string };
};

export function getSafeIntegrationStatus(): IntegrationStatusDTO {
  const email = getEmailProviderStatus();
  return {
    storage: { provider: "Vercel Blob", mode: "Private", configured: isStorageConfigured(), region: "Managed by Vercel" },
    email: { provider: "None", configured: false, detail: email.statusMessage },
    sms: { provider: "None", configured: false, detail: "No SMS delivery provider is installed or configured." },
    runtimeNotifications: { provider: "Database-backed in-app notifications", configured: true, detail: "Runtime inbox records are enabled independently of outbound delivery." },
    payments: { provider: "None", configured: false, detail: "Not configured — Phase 8 pending." },
  };
}

export function getSafeSecurityStatus() {
  return {
    minimumPasswordLength: 8,
    bcryptCost: 12,
    passwordComplexity: "No additional complexity or password-history policy is enforced.",
    sessionStrategy: "Signed JWT session",
    configurableSessionLifetime: false,
    authSecretConfigured: Boolean(process.env.AUTH_SECRET),
    trustedHostPolicy: "Trusted host mode enabled for the managed deployment environment.",
    accountLifecycle: "Only ACTIVE users may authenticate; protected requests re-check current database status.",
    authorizationModel: "Relational role assignments and permissions; legacy role values do not grant authorization.",
    branchScope: "Relational global or explicitly assigned branch access is enforced server-side.",
  };
}

export function getSafeOperationalStatus() {
  return {
    environment: process.env.VERCEL_ENV === "production" ? "Production" : process.env.VERCEL_ENV === "preview" ? "Preview" : "Local development",
    baseCurrency: "INR (₹) only",
    maintenanceMode: "Not implemented",
    schemaManagement: "Prisma migrations at deployment; no runtime schema repair",
  };
}

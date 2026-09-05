import { requirePermission, getUserAuthorizedBranchScope, getUserEffectivePermissions } from "@/lib/auth/authorize";
import { getCompanyProfile } from "@/lib/settings/company-profile";
import { getAllBranchesWithCounts } from "@/lib/settings/branch-service";
import { getEmailConfiguration, getEmailProviderStatus } from "@/lib/settings/email-service";
import { getAllNotificationTemplates } from "@/lib/settings/notification-service";
import { isPublicBrandingStorageConfigured } from "@/lib/storage/public-branding-storage";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

async function loadSettingsData() {
  try {
    const actor = await requirePermission("settings.view");
    const [permissions, branchScope] = await Promise.all([
      getUserEffectivePermissions(actor.id),
      getUserAuthorizedBranchScope(actor.id),
    ]);

    const canManageCompany = permissions.has("settings.company.manage");
    const canManageBranch = permissions.has("settings.branch.manage") && branchScope.global;
    const canManageFinancial = permissions.has("settings.financial.manage");
    const canManageNotifications = permissions.has("settings.notifications.manage");
    const canManageIntegrations = permissions.has("settings.integrations.manage");

    const rawProfile = await getCompanyProfile();
    const branches = canManageBranch ? await getAllBranchesWithCounts() : [];
    const rawEmailConfig = await getEmailConfiguration();
    const providerStatus = getEmailProviderStatus();
    const rawTemplates = await getAllNotificationTemplates();
    const publicBrandingStorageConfigured = isPublicBrandingStorageConfigured();

    const safeProfile = {
      id: rawProfile.id,
      legalName: rawProfile.legalName ?? null,
      displayName: rawProfile.displayName ?? "KN Finance Company",
      tagline: rawProfile.tagline ?? "Empowering your future",
      registrationNumber: rawProfile.registrationNumber ?? null,
      taxId: rawProfile.taxId ?? null,
      licenseNumber: rawProfile.licenseNumber ?? null,
      email: rawProfile.email ?? null,
      phone: rawProfile.phone ?? null,
      website: rawProfile.website ?? null,
      address: rawProfile.address ?? null,
      city: rawProfile.city ?? null,
      state: rawProfile.state ?? null,
      country: rawProfile.country ?? null,
      timezone: rawProfile.timezone ?? "UTC",
      dateFormat: rawProfile.dateFormat ?? "YYYY-MM-DD",
      timeFormat: rawProfile.timeFormat ?? "12h",
      locale: rawProfile.locale ?? "en-IN",
      logoUrl: rawProfile.logoUrl ?? "/branding/kn-finance-logo.png",
      faviconUrl: rawProfile.faviconUrl ?? "/favicon.ico",
      metaDescription: rawProfile.metaDescription ?? null,
    };

    const safeBranches = (branches || []).map((b) => ({
      id: String(b.id ?? ""),
      name: String(b.name ?? ""),
      code: String(b.code ?? ""),
      email: String(b.email ?? ""),
      phone: String(b.phone ?? ""),
      address: String(b.address ?? ""),
      city: String(b.city ?? ""),
      state: String(b.state ?? ""),
      country: String(b.country ?? ""),
      currency: String(b.currency ?? "INR"),
      status: String(b.status ?? "ACTIVE"),
      userCount: b._count?.users ?? 0,
      memberCount: b._count?.members ?? 0,
      accountCount: b._count?.accounts ?? 0,
      loanCount: b._count?.loans ?? 0,
    }));

    const safeEmailConfig = {
      id: String(rawEmailConfig.id ?? "email-config-main"),
      enabled: Boolean(rawEmailConfig.enabled),
      provider: String(rawEmailConfig.provider ?? "NONE"),
      senderName: String(rawEmailConfig.senderName ?? "KN Finance Company"),
      senderEmail: rawEmailConfig.senderEmail ?? null,
      replyToEmail: rawEmailConfig.replyToEmail ?? null,
    };

    const safeTemplates = (rawTemplates || []).map((t) => ({
      id: String(t.id ?? ""),
      code: String(t.code ?? ""),
      name: String(t.name ?? ""),
      description: String(t.description ?? ""),
      channel: String(t.channel ?? "EMAIL"),
      subject: String(t.subject ?? ""),
      bodyTemplate: String(t.bodyTemplate ?? ""),
      variables: Array.isArray(t.variables) ? (t.variables as string[]) : [],
      isEnabled: Boolean(t.isEnabled),
    }));

    return {
      safeProfile,
      safeBranches,
      safeEmailConfig,
      providerStatus,
      safeTemplates,
      publicBrandingStorageConfigured,
      canManageCompany,
      canManageBranch,
      canManageFinancial,
      canManageNotifications,
      canManageIntegrations,
    };
  } catch (error: unknown) {
    const err = error as Error;
    console.error("[SETTINGS_PAGE_ERROR]", {
      name: err?.name,
      message: err?.message,
      stack: err?.stack?.split("\n").slice(0, 3).join(" "),
    });
    throw error;
  }
}

export default async function SettingsPage() {
  const data = await loadSettingsData();

  return (
    <SettingsClient
      profile={data.safeProfile}
      branches={data.safeBranches}
      emailConfig={data.safeEmailConfig}
      providerStatus={data.providerStatus}
      templates={data.safeTemplates}
      publicBrandingStorageConfigured={data.publicBrandingStorageConfigured}
      canManageCompany={data.canManageCompany}
      canManageBranch={data.canManageBranch}
      canManageFinancial={data.canManageFinancial}
      canManageNotifications={data.canManageNotifications}
      canManageIntegrations={data.canManageIntegrations}
    />
  );
}

import { requirePermission, getUserEffectivePermissions } from "@/lib/auth/authorize";
import { getCompanyProfile } from "@/lib/settings/company-profile";
import { getAllBranchesWithCounts } from "@/lib/settings/branch-service";
import { SettingsClient } from "./settings-client";

export const dynamic = "force-dynamic";

async function loadSettingsData() {
  try {
    const actor = await requirePermission("settings.view");
    const permissions = await getUserEffectivePermissions(actor.id);

    const canManageCompany = permissions.has("settings.company.manage");
    const canManageBranch = permissions.has("settings.branch.manage");
    const canManageFinancial = permissions.has("settings.financial.manage");

    const rawProfile = await getCompanyProfile();
    const branches = await getAllBranchesWithCounts();

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
      locale: rawProfile.locale ?? "en-US",
      logoUrl: rawProfile.logoUrl ?? "/branding/kn-finance-logo.png",
      faviconUrl: rawProfile.faviconUrl ?? "/favicon.ico",
      metaDescription: rawProfile.metaDescription ?? null,
    };

    const safeBranches = (branches || []).map((b) => ({
      id: b.id,
      name: b.name,
      code: b.code,
      email: b.email,
      phone: b.phone,
      address: b.address,
      city: b.city,
      state: b.state,
      country: b.country,
      currency: b.currency,
      status: b.status,
      userCount: b._count?.users ?? 0,
      memberCount: b._count?.members ?? 0,
      accountCount: b._count?.accounts ?? 0,
      loanCount: b._count?.loans ?? 0,
    }));

    return {
      safeProfile,
      safeBranches,
      canManageCompany,
      canManageBranch,
      canManageFinancial,
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
      canManageCompany={data.canManageCompany}
      canManageBranch={data.canManageBranch}
      canManageFinancial={data.canManageFinancial}
    />
  );
}

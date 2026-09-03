import { requirePermission, getUserEffectivePermissions } from "@/lib/auth/authorize";
import { prisma } from "@/lib/prisma";
import { getCompanyProfile } from "@/lib/settings/company-profile";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const actor = await requirePermission("settings.view");
  const permissions = await getUserEffectivePermissions(actor.id);
  const canManageCompany = permissions.has("settings.company.manage") || actor.role === "SUPER_ADMIN";

  const rawProfile = await getCompanyProfile();
  const branches = await prisma.branch.findMany({
    orderBy: { code: "asc" },
  });

  const safeProfile = {
    id: rawProfile.id,
    legalName: rawProfile.legalName,
    displayName: rawProfile.displayName,
    tagline: rawProfile.tagline,
    registrationNumber: rawProfile.registrationNumber,
    taxId: rawProfile.taxId,
    licenseNumber: rawProfile.licenseNumber,
    email: rawProfile.email,
    phone: rawProfile.phone,
    website: rawProfile.website,
    address: rawProfile.address,
    city: rawProfile.city,
    state: rawProfile.state,
    country: rawProfile.country,
    timezone: rawProfile.timezone,
    dateFormat: rawProfile.dateFormat,
    timeFormat: rawProfile.timeFormat,
    locale: rawProfile.locale,
    logoUrl: rawProfile.logoUrl,
    faviconUrl: rawProfile.faviconUrl,
    metaDescription: rawProfile.metaDescription,
  };

  const safeBranches = branches.map((b) => ({
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
  }));

  return <SettingsClient profile={safeProfile} branches={safeBranches} canManageCompany={canManageCompany} />;
}

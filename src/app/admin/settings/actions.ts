"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { getCompanyProfile, updateCompanyProfile, UpdateCompanyProfileInput } from "@/lib/settings/company-profile";

export async function getCompanyProfileAction() {
  await requirePermission("settings.view");
  const profile = await getCompanyProfile();
  return { success: true, profile };
}

export async function updateGeneralSettingsAction(input: UpdateCompanyProfileInput) {
  const sessionUser = await requirePermission("settings.company.manage");
  const profile = await updateCompanyProfile(sessionUser.id, input);
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true, profile };
}

export async function updateBrandingSettingsAction(input: UpdateCompanyProfileInput) {
  const sessionUser = await requirePermission("settings.company.manage");
  const profile = await updateCompanyProfile(sessionUser.id, input);
  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  return { success: true, profile };
}

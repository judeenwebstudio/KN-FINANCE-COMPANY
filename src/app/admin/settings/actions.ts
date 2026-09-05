"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { getCompanyProfile, updateCompanyProfile, UpdateCompanyProfileInput } from "@/lib/settings/company-profile";
import {
  isPublicBrandingStorageConfigured,
  uploadPublicBrandingAsset,
  deletePublicBrandingAsset,
} from "@/lib/storage/public-branding-storage";
import { validateBrandingFile, BrandingAssetKind } from "@/lib/settings/branding-validation";
import { logAuditEvent } from "@/lib/audit/audit-logger";

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

export async function uploadBrandingAssetAction(formData: FormData) {
  const sessionUser = await requirePermission("settings.company.manage");

  const kind = formData.get("kind")?.toString() as BrandingAssetKind;
  const file = formData.get("file") as File | null;

  if (!kind || !["logo", "favicon"].includes(kind)) {
    return { success: false, error: "Invalid asset category specified." };
  }

  if (!file || !(file instanceof File) || file.size === 0) {
    return { success: false, error: "No file selected for upload." };
  }

  // Fail closed truthfully if public storage is unconfigured
  if (!isPublicBrandingStorageConfigured()) {
    return {
      success: false,
      error:
        "Public branding storage is not configured. Custom uploads require PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN. Existing asset remains unchanged.",
    };
  }

  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const validation = validateBrandingFile(kind, {
    name: file.name,
    size: file.size,
    type: file.type,
    bytes,
  });

  if (!validation.valid) {
    return { success: false, error: validation.error || "File validation failed." };
  }

  const currentProfile = await getCompanyProfile();
  const oldUrl = kind === "logo" ? currentProfile.logoUrl : currentProfile.faviconUrl;

  // 1. Upload new asset to public storage first
  let newUrl: string;
  try {
    newUrl = await uploadPublicBrandingAsset(kind, bytes, validation.mimeType, file.name);
  } catch (err: unknown) {
    const msg = (err as Error)?.message || "Public storage upload failed.";
    return { success: false, error: msg };
  }

  // 2. Persist DB reference after upload succeeds
  try {
    const updatedInput: UpdateCompanyProfileInput = {
      displayName: currentProfile.displayName,
      legalName: currentProfile.legalName,
      tagline: currentProfile.tagline,
      email: currentProfile.email,
      phone: currentProfile.phone,
      website: currentProfile.website,
      address: currentProfile.address,
      city: currentProfile.city,
      state: currentProfile.state,
      country: currentProfile.country,
      timezone: currentProfile.timezone,
      dateFormat: currentProfile.dateFormat,
      timeFormat: currentProfile.timeFormat,
      locale: currentProfile.locale,
      logoUrl: kind === "logo" ? newUrl : currentProfile.logoUrl,
      faviconUrl: kind === "favicon" ? newUrl : currentProfile.faviconUrl,
      metaDescription: currentProfile.metaDescription,
    };

    const profile = await updateCompanyProfile(sessionUser.id, updatedInput);

    // 3. Delete old custom asset only AFTER DB update succeeds
    if (oldUrl && oldUrl !== newUrl && oldUrl.startsWith("http")) {
      await deletePublicBrandingAsset(oldUrl).catch(() => {});
    }

    await logAuditEvent({
      actorUserId: sessionUser.id,
      action: kind === "logo" ? "company_profile.logo_upload" : "company_profile.favicon_upload",
      entityType: "CompanyProfile",
      entityId: profile.id,
      metadata: {
        assetKind: kind,
        fileName: file.name,
        sizeBytes: file.size,
        mimeType: validation.mimeType,
      },
    });

    revalidatePath("/admin/settings");
    revalidatePath("/admin");
    revalidatePath("/login");
    revalidatePath("/");

    return { success: true, url: newUrl, profile };
  } catch (dbErr: unknown) {
    // 4. Clean up newly uploaded asset if DB update fails
    await deletePublicBrandingAsset(newUrl).catch(() => {});
    return {
      success: false,
      error: "Failed to persist branding settings to database. Uploaded asset was cleaned up.",
    };
  }
}

export async function restoreBrandingDefaultAction(kind: BrandingAssetKind) {
  const sessionUser = await requirePermission("settings.company.manage");
  const currentProfile = await getCompanyProfile();
  const oldUrl = kind === "logo" ? currentProfile.logoUrl : currentProfile.faviconUrl;

  const defaultUrl = kind === "logo" ? "/branding/kn-finance-logo.png" : "/favicon.ico";

  const updatedInput: UpdateCompanyProfileInput = {
    displayName: currentProfile.displayName,
    legalName: currentProfile.legalName,
    tagline: currentProfile.tagline,
    email: currentProfile.email,
    phone: currentProfile.phone,
    website: currentProfile.website,
    address: currentProfile.address,
    city: currentProfile.city,
    state: currentProfile.state,
    country: currentProfile.country,
    timezone: currentProfile.timezone,
    dateFormat: currentProfile.dateFormat,
    timeFormat: currentProfile.timeFormat,
    locale: currentProfile.locale,
    logoUrl: kind === "logo" ? defaultUrl : currentProfile.logoUrl,
    faviconUrl: kind === "favicon" ? defaultUrl : currentProfile.faviconUrl,
    metaDescription: currentProfile.metaDescription,
  };

  const profile = await updateCompanyProfile(sessionUser.id, updatedInput);

  if (oldUrl && oldUrl !== defaultUrl && oldUrl.startsWith("http")) {
    await deletePublicBrandingAsset(oldUrl).catch(() => {});
  }

  await logAuditEvent({
    actorUserId: sessionUser.id,
    action: "company_profile.branding_reset",
    entityType: "CompanyProfile",
    entityId: profile.id,
    metadata: { assetKind: kind, defaultUrl },
  });

  revalidatePath("/admin/settings");
  revalidatePath("/admin");
  revalidatePath("/login");
  revalidatePath("/");

  return { success: true, profile };
}

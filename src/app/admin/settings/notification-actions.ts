"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import {
  updateNotificationTemplate,
  toggleNotificationTemplateStatus,
  UpdateTemplateInput,
  renderTemplatePreview,
} from "@/lib/settings/notification-service";

export async function updateNotificationTemplateAction(code: string, input: UpdateTemplateInput) {
  const sessionUser = await requirePermission("settings.notifications.manage");
  const template = await updateNotificationTemplate(sessionUser.id, code, input);
  revalidatePath("/admin/settings");
  return { success: true, template };
}

export async function toggleNotificationTemplateStatusAction(code: string, isEnabled: boolean) {
  const sessionUser = await requirePermission("settings.notifications.manage");
  const template = await toggleNotificationTemplateStatus(sessionUser.id, code, isEnabled);
  revalidatePath("/admin/settings");
  return { success: true, template };
}

export async function getTemplatePreviewAction(code: string, subject: string, bodyTemplate: string) {
  await requirePermission("settings.notifications.manage");
  const preview = renderTemplatePreview(code, subject, bodyTemplate);
  return { success: true, preview };
}

"use server";

import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/auth/authorize";
import { updateEmailConfiguration, EmailConfigurationInput, sendTestEmail } from "@/lib/settings/email-service";

export async function updateEmailSettingsAction(input: EmailConfigurationInput) {
  const sessionUser = await requirePermission("settings.integrations.manage");
  const config = await updateEmailConfiguration(sessionUser.id, input);
  revalidatePath("/admin/settings");
  return { success: true, config };
}

export async function sendTestEmailAction(recipientEmail: string) {
  const sessionUser = await requirePermission("settings.integrations.manage");
  const result = await sendTestEmail(sessionUser.id, recipientEmail);
  return result;
}

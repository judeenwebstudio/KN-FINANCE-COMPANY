"use server";

import { requirePermission } from "@/lib/auth/authorize";
import { changeOwnPassword, type ChangePasswordInput } from "@/lib/settings/password-security";

export async function changePasswordAction(input: ChangePasswordInput) {
  const actor = await requirePermission("settings.view");
  return changeOwnPassword(actor.id, input);
}

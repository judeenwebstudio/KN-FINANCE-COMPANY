"use server";

import { redirect } from "next/navigation";
import { resetPasswordWithToken, PasswordResetError } from "@/lib/auth/password-reset";

export type ResetPasswordState = {
  error?: string;
};

export async function resetPasswordAction(
  _: ResetPasswordState,
  formData: FormData
): Promise<ResetPasswordState> {
  const token = formData.get("token")?.toString() || "";
  const newPassword = formData.get("newPassword")?.toString() || "";
  const confirmPassword = formData.get("confirmPassword")?.toString() || "";

  if (!token) {
    return { error: "Password reset link is invalid or expired." };
  }

  if (!newPassword || newPassword.length < 8) {
    return { error: "Password must be at least 8 characters long." };
  }

  if (newPassword !== confirmPassword) {
    return { error: "New password and confirmation do not match." };
  }

  try {
    await resetPasswordWithToken(token, newPassword);
  } catch (err) {
    if (err instanceof PasswordResetError) {
      return { error: err.message };
    }
    return { error: "An unexpected error occurred during password reset. Please try again." };
  }

  // Redirect to clean login URL so token is removed from address bar
  redirect("/login?reset=success");
}

"use server";

import { requestPasswordReset } from "@/lib/auth/password-reset";

export type ForgotPasswordState = {
  error?: string;
  successMessage?: string;
};

export async function forgotPasswordAction(
  _: ForgotPasswordState,
  formData: FormData
): Promise<ForgotPasswordState> {
  const email = formData.get("email")?.toString() || "";

  if (!email || !email.includes("@")) {
    return { error: "Please enter a valid email address." };
  }

  try {
    const result = await requestPasswordReset(email);
    return { successMessage: result.message };
  } catch {
    return { error: "An unexpected error occurred. Please try again." };
  }
}

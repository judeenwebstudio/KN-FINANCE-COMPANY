/**
 * Google reCAPTCHA Protection & Verification Helper (LOGIN ONLY).
 * 
 * Invariants:
 * 1. Scope is LOGIN FORM ONLY.
 * 2. RECAPTCHA_SECRET_KEY is strictly server-side only and never exposed in DTOs, client bundles, or logs.
 * 3. When unconfigured, login proceeds normally (fails open truthfully reporting Not Configured).
 * 4. Server-side verification is mandatory when configured.
 */

export function isRecaptchaConfigured(): boolean {
  return Boolean(
    process.env.RECAPTCHA_SECRET_KEY &&
      (process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY)
  );
}

export function getRecaptchaSiteKey(): string {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || process.env.RECAPTCHA_SITE_KEY || "";
}

export type RecaptchaVerificationResult = {
  success: boolean;
  configured: boolean;
  error?: string;
};

export async function verifyRecaptchaToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<RecaptchaVerificationResult> {
  const configured = isRecaptchaConfigured();

  if (!configured) {
    // Fails open when reCAPTCHA is intentionally unconfigured
    return { success: true, configured: false };
  }

  const cleanToken = token?.trim();
  if (!cleanToken) {
    return {
      success: false,
      configured: true,
      error: "Google reCAPTCHA verification token is required for login.",
    };
  }

  try {
    const params = new URLSearchParams({
      secret: process.env.RECAPTCHA_SECRET_KEY!,
      response: cleanToken,
    });

    if (remoteIp) {
      params.append("remoteip", remoteIp);
    }

    const res = await fetch("https://www.google.com/recaptcha/api/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        success: false,
        configured: true,
        error: `reCAPTCHA verification provider returned HTTP status ${res.status}`,
      };
    }

    const data = (await res.json()) as { success?: boolean; score?: number; "error-codes"?: string[] };

    if (data.success === true) {
      return { success: true, configured: true };
    }

    return {
      success: false,
      configured: true,
      error: "reCAPTCHA verification failed. Please complete the reCAPTCHA challenge and try again.",
    };
  } catch (error) {
    console.error("[reCAPTCHA Verification Error]", error);
    return {
      success: false,
      configured: true,
      error: "Network error verifying reCAPTCHA challenge. Please try again.",
    };
  }
}

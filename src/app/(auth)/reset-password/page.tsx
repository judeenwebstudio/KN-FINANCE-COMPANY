import Image from "next/image";
import Link from "next/link";
import { AlertCircle, ArrowLeft, ArrowRight } from "lucide-react";
import { ResetPasswordForm } from "./reset-password-form";
import { verifyPasswordResetToken } from "@/lib/auth/password-reset";

export const dynamic = "force-dynamic";

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token || "";

  const verification = await verifyPasswordResetToken(token);

  return (
    <main
      className="flex min-h-screen min-h-dvh items-center justify-center overflow-x-hidden bg-cover bg-center bg-no-repeat px-4 py-6 sm:px-6"
      style={{ backgroundImage: "url('/branding/kn-finance-login-bg.png')" }}
    >
      <section className="w-full max-w-[475px] -translate-y-1 sm:-translate-y-2">
        {/* Logo */}
        <div className="mb-[18px] flex justify-center">
          <Image
            src="/branding/kn-finance-logo.png"
            alt="KN Finance Company — Empowering your future"
            width={760}
            height={420}
            className="h-auto w-[150px] object-contain drop-shadow-sm sm:w-[185px]"
            priority
          />
        </div>

        {/* Header copy */}
        <div className="mb-3 text-center">
          <div className="mb-[10px] flex items-center gap-3">
            <div className="h-px flex-1 bg-[#b8962e]/50" />
            <span className="text-[10px] font-bold tracking-[.26em] text-[#b8962e] uppercase">
              Security Update
            </span>
            <div className="h-px flex-1 bg-[#b8962e]/50" />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#1a2e5a] sm:text-[28px]">
            Set new password
          </h1>
          <p className="mt-[7px] text-sm text-slate-500">
            {verification.valid
              ? "Enter your new password below."
              : "Verify your reset token."}
          </p>
        </div>

        <div className="rounded-[20px] border border-white/80 bg-white/[0.96] px-5 py-5 shadow-[0_18px_55px_rgba(26,46,90,.14),0_3px_12px_rgba(26,46,90,.07)] backdrop-blur-[5px] sm:px-7 sm:py-6">
          {!verification.valid ? (
            <div className="space-y-5 text-center">
              <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <AlertCircle className="size-6" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  Link Invalid or Expired
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Password reset link is invalid or expired.
                </p>
              </div>
              <div className="pt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-center">
                <Link
                  href="/forgot-password"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1a2e5a] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1e3a6e]"
                >
                  Request a new reset link
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#1a2e5a]"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Back to Sign in
                </Link>
              </div>
            </div>
          ) : (
            <ResetPasswordForm token={token} />
          )}
        </div>
      </section>
    </main>
  );
}

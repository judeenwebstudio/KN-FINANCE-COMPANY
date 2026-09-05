import Image from "next/image";
import { LoginForm } from "./login-form";
import { getRecaptchaSiteKey } from "@/lib/security/recaptcha";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  const recaptchaSiteKey = getRecaptchaSiteKey();

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
          {/* Gold rule + WELCOME BACK */}
          <div className="mb-[10px] flex items-center gap-3">
            <div className="h-px flex-1 bg-[#b8962e]/50" />
            <span className="text-[10px] font-bold tracking-[.26em] text-[#b8962e] uppercase">Welcome Back</span>
            <div className="h-px flex-1 bg-[#b8962e]/50" />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#1a2e5a] sm:text-[28px]">
            Sign in to your account
          </h1>
          <p className="mt-[7px] text-sm text-slate-500">Enter your credentials to continue.</p>
        </div>

        <div className="rounded-[20px] border border-white/80 bg-white/[0.96] px-5 py-5 shadow-[0_18px_55px_rgba(26,46,90,.14),0_3px_12px_rgba(26,46,90,.07)] backdrop-blur-[5px] sm:px-7 sm:py-6">
          <LoginForm recaptchaSiteKey={recaptchaSiteKey} />
        </div>
      </section>
    </main>
  );
}

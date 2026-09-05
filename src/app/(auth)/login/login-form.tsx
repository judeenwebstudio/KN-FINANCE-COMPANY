"use client";

import { useActionState, useState } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, Users } from "lucide-react";
import { loginAction } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/* ── Shared input style ── */
const inputClass =
  "h-[54px] w-full rounded-xl border border-slate-200/90 bg-white/90 text-sm text-slate-900 " +
  "transition-[border-color,background-color,box-shadow] duration-200 " +
  "placeholder:text-slate-400 hover:border-slate-300 hover:bg-white " +
  "focus:border-[#1a2e5a] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#1a2e5a]/10 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff]";

export function LoginForm({ recaptchaSiteKey }: { recaptchaSiteKey?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const hasError = Boolean(state.error);

  return (
    <form action={action} className="space-y-4">
      {recaptchaSiteKey ? (
        <input type="hidden" name="g-recaptcha-response" value={recaptchaToken} />
      ) : null}

      {/* ── Email ── */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700" htmlFor="email">
          Email address
        </label>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3.5 top-4 size-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            disabled={pending}
            aria-invalid={hasError}
            aria-describedby={hasError ? "login-error" : undefined}
            className={cn(
              inputClass,
              "pl-11 pr-3",
              hasError && "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            )}
            placeholder="you@company.com"
          />
        </div>
      </div>

      {/* ── Password ── */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700" htmlFor="password">
          Password
        </label>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3.5 top-4 size-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            minLength={8}
            required
            disabled={pending}
            aria-invalid={hasError}
            aria-describedby={hasError ? "login-error" : undefined}
            className={cn(
              inputClass,
              "pl-11 pr-12",
              hasError && "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            )}
            placeholder="Enter your password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            disabled={pending}
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            className="absolute right-2 top-[11px] grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#1a2e5a] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a2e5a] disabled:pointer-events-none disabled:opacity-50"
          >
            {showPassword
              ? <EyeOff className="size-[18px]" aria-hidden="true" />
              : <Eye   className="size-[18px]" aria-hidden="true" />
            }
          </button>
        </div>
      </div>

      {/* ── Remember me + Forgot password ── */}
      <div className="flex items-center justify-between gap-4 text-sm">
        <label
          className="flex cursor-pointer items-center gap-2 text-slate-600"
          htmlFor="remember-me"
        >
          <input
            id="remember-me"
            type="checkbox"
            disabled={pending}
            className="size-4 rounded border-slate-300 accent-[#1a2e5a] focus:ring-2 focus:ring-[#1a2e5a]/20"
          />
          Remember me
        </label>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Password recovery is not available yet"
          className="cursor-not-allowed font-medium text-slate-400"
        >
          Forgot password?
        </button>
      </div>

      {/* ── Error ── */}
      {state.error && (
        <p
          id="login-error"
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
        >
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
          {state.error}
        </p>
      )}

      {/* ── Sign-in button ── */}
      <Button
        className="group h-[54px] w-full rounded-xl bg-[#1a2e5a] text-sm font-semibold tracking-wide shadow-sm shadow-[#1a2e5a]/30 transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#1e3a6e] hover:shadow-md hover:shadow-[#1a2e5a]/25 active:translate-y-px focus-visible:ring-[#b8962e]/60"
        disabled={pending}
        aria-disabled={pending}
      >
        {pending
          ? <LoaderCircle className="mr-2 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          : null
        }
        {pending ? "Signing in…" : "Sign in"}
        {!pending && (
          <ArrowRight
            className="ml-2 size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </Button>

      {/* ── Separator ── */}
      <div className="relative flex items-center gap-3 py-0.5">
        <div className="h-px flex-1 bg-slate-200" />
        <span className="text-xs text-slate-400">or</span>
        <div className="h-px flex-1 bg-slate-200" />
      </div>

      {/* ── Member login — same credentials form, visual portal hint ── */}
      <button
        type="button"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white/60 py-2 text-sm font-medium text-slate-600 transition-colors hover:border-[#1a2e5a]/30 hover:bg-white hover:text-[#1a2e5a] disabled:pointer-events-none disabled:opacity-50"
        title="Members use the same login form — sign in above"
        aria-label="Member Login — use the sign-in form above"
      >
        <Users className="size-4" aria-hidden="true" />
        Member Login
      </button>

    </form>
  );
}

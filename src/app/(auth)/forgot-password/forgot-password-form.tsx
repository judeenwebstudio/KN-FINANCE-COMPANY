"use client";

import { useActionState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { forgotPasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-[54px] w-full rounded-xl border border-slate-200/90 bg-white/90 text-sm text-slate-900 " +
  "transition-[border-color,background-color,box-shadow] duration-200 " +
  "placeholder:text-slate-400 hover:border-slate-300 hover:bg-white " +
  "focus:border-[#1a2e5a] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#1a2e5a]/10 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff]";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, {});

  const hasError = Boolean(state.error);
  const isSubmitted = Boolean(state.successMessage);

  if (isSubmitted) {
    return (
      <div className="space-y-5 text-center">
        <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
          <CheckCircle2 className="size-6" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-slate-900">Instructions Sent</h3>
          <p className="text-sm text-slate-600 leading-relaxed">
            {state.successMessage}
          </p>
        </div>
        <div className="pt-2">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-[#1a2e5a] hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      {/* Email Input */}
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
            aria-describedby={hasError ? "forgot-error" : undefined}
            className={cn(
              inputClass,
              "pl-11 pr-3",
              hasError && "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            )}
            placeholder="you@company.com"
          />
        </div>
      </div>

      {/* Error Message */}
      {state.error && (
        <p
          id="forgot-error"
          role="alert"
          aria-live="polite"
          className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700"
        >
          <span className="mt-1 size-1.5 shrink-0 rounded-full bg-rose-500" aria-hidden="true" />
          {state.error}
        </p>
      )}

      {/* Submit Button */}
      <Button
        className="group h-[54px] w-full rounded-xl bg-[#1a2e5a] text-sm font-semibold tracking-wide shadow-sm shadow-[#1a2e5a]/30 transition-[background-color,box-shadow,transform] duration-200 hover:bg-[#1e3a6e] hover:shadow-md hover:shadow-[#1a2e5a]/25 active:translate-y-px focus-visible:ring-[#b8962e]/60"
        disabled={pending}
        aria-disabled={pending}
      >
        {pending ? (
          <LoaderCircle className="mr-2 size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
        ) : null}
        {pending ? "Submitting…" : "Reset Password"}
        {!pending && (
          <ArrowRight
            className="ml-2 size-4 transition-transform duration-200 group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        )}
      </Button>

      {/* Back to Sign in */}
      <div className="text-center pt-1">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 transition-colors hover:text-[#1a2e5a]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Sign in
        </Link>
      </div>
    </form>
  );
}

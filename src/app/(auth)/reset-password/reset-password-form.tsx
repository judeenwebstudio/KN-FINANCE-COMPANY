"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole } from "lucide-react";
import { resetPasswordAction } from "./actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const inputClass =
  "h-[54px] w-full rounded-xl border border-slate-200/90 bg-white/90 text-sm text-slate-900 " +
  "transition-[border-color,background-color,box-shadow] duration-200 " +
  "placeholder:text-slate-400 hover:border-slate-300 hover:bg-white " +
  "focus:border-[#1a2e5a] focus:bg-white focus:outline-none focus:ring-4 focus:ring-[#1a2e5a]/10 " +
  "disabled:cursor-not-allowed disabled:opacity-60 " +
  "[&:-webkit-autofill]:shadow-[inset_0_0_0_1000px_#fff]";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, {});
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const hasError = Boolean(state.error);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {/* New Password */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700" htmlFor="newPassword">
          New password
        </label>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3.5 top-4 size-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="newPassword"
            name="newPassword"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            required
            disabled={pending}
            aria-invalid={hasError}
            aria-describedby={hasError ? "reset-error" : undefined}
            className={cn(
              inputClass,
              "pl-11 pr-12",
              hasError && "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            )}
            placeholder="At least 8 characters"
          />
          <button
            type="button"
            onClick={() => setShowNewPassword((v) => !v)}
            disabled={pending}
            aria-label={showNewPassword ? "Hide password" : "Show password"}
            aria-pressed={showNewPassword}
            className="absolute right-2 top-[11px] grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#1a2e5a] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a2e5a] disabled:pointer-events-none disabled:opacity-50"
          >
            {showNewPassword ? (
              <EyeOff className="size-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="size-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Confirm New Password */}
      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-slate-700" htmlFor="confirmPassword">
          Confirm new password
        </label>
        <div className="relative">
          <LockKeyhole
            className="pointer-events-none absolute left-3.5 top-4 size-5 text-slate-400"
            aria-hidden="true"
          />
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={8}
            required
            disabled={pending}
            aria-invalid={hasError}
            aria-describedby={hasError ? "reset-error" : undefined}
            className={cn(
              inputClass,
              "pl-11 pr-12",
              hasError && "border-rose-300 focus:border-rose-500 focus:ring-rose-100"
            )}
            placeholder="Re-enter your new password"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((v) => !v)}
            disabled={pending}
            aria-label={showConfirmPassword ? "Hide password" : "Show password"}
            aria-pressed={showConfirmPassword}
            className="absolute right-2 top-[11px] grid size-8 place-items-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-[#1a2e5a] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#1a2e5a] disabled:pointer-events-none disabled:opacity-50"
          >
            {showConfirmPassword ? (
              <EyeOff className="size-[18px]" aria-hidden="true" />
            ) : (
              <Eye className="size-[18px]" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {state.error && (
        <p
          id="reset-error"
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
        {pending ? "Updating password…" : "Save New Password"}
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

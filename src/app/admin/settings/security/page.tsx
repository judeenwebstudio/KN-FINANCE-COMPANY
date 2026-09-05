import { requirePermission } from "@/lib/auth/authorize";
import { getSafeSecurityStatus } from "@/lib/settings/system-status";
import { PasswordForm } from "./password-form";

export const dynamic = "force-dynamic";

export default async function SecuritySettingsPage() {
  await requirePermission("settings.view");
  const policy = getSafeSecurityStatus();
  const items = [
    ["Password storage", `bcrypt, work factor ${policy.bcryptCost}`],
    ["Minimum password length", `${policy.minimumPasswordLength} characters`],
    ["Password complexity/history", policy.passwordComplexity],
    ["Session policy", `${policy.sessionStrategy}; lifetime is ${policy.configurableSessionLifetime ? "configurable" : "not configurable in the admin UI"}`],
    ["Authentication secret", policy.authSecretConfigured ? "Configured" : "Missing — authentication unavailable"],
    ["Host policy", policy.trustedHostPolicy],
    ["Account lifecycle", policy.accountLifecycle],
    ["Admin access", policy.authorizationModel],
    ["Branch scope", policy.branchScope],
    [
      "Google reCAPTCHA",
      `${policy.recaptcha.configured ? "Configured" : "Not Configured"} — ${policy.recaptcha.protectionScope} (Server Verification: ${policy.recaptcha.serverVerification})`,
    ],
  ];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-[.18em] text-[#a77b27]">Security</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-950">Security & Access</h1>
        <p className="mt-1 text-sm text-slate-500">Policies and authentication protections currently enforced by the application.</p>
      </header>
      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h2 className="font-semibold text-slate-900">Enforced policy</h2>
          <dl className="mt-4 divide-y divide-slate-100">
            {items.map(([term, detail]) => (
              <div key={term} className="grid gap-1 py-3 sm:grid-cols-[190px_1fr]">
                <dt className="text-xs font-semibold text-slate-600">{term}</dt>
                <dd className="text-xs leading-5 text-slate-700">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>
        <PasswordForm />
      </div>
    </div>
  );
}

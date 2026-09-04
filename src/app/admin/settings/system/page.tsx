import { forbidden } from "next/navigation";
import { getUserEffectivePermissions, requirePermission } from "@/lib/auth/authorize";
import { getSafeOperationalStatus } from "@/lib/settings/system-status";
import { SettingsStatusCard } from "@/components/settings-status-card";

export const dynamic = "force-dynamic";

export default async function SystemSettingsPage() {
  const actor = await requirePermission("settings.view");
  const permissions = await getUserEffectivePermissions(actor.id);
  if (!permissions.has("settings.update")) forbidden();
  const status = getSafeOperationalStatus();
  return <div className="space-y-6"><header><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a77b27]">Operations</p><h1 className="mt-1 text-2xl font-bold text-slate-950">System & Operations</h1><p className="mt-1 text-sm text-slate-500">Read-only operational policy and environment status.</p></header><div className="grid gap-4 md:grid-cols-2">
    <SettingsStatusCard title="Application Environment" provider={status.environment} status="Operational" detail="Environment label only; infrastructure secrets and environment values are not exposed." />
    <SettingsStatusCard title="Base Currency Policy" provider={status.baseCurrency} status="Operational" detail="All authoritative monetary workflows remain INR-only. This page performs no conversion or financial mutation." />
    <SettingsStatusCard title="Schema Management" provider="Deployment-managed" status="Operational" detail={status.schemaManagement} />
    <SettingsStatusCard title="Maintenance Mode" provider="No infrastructure present" status="Not implemented" detail="Deferred: a safe global maintenance gate and Super Administrator bypass do not currently exist. No decorative kill-switch is provided." />
  </div></div>;
}

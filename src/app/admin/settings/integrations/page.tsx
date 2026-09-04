import { forbidden } from "next/navigation";
import { getUserEffectivePermissions, requirePermission } from "@/lib/auth/authorize";
import { getSafeIntegrationStatus } from "@/lib/settings/system-status";
import { SettingsStatusCard } from "@/components/settings-status-card";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const actor = await requirePermission("settings.view");
  const permissions = await getUserEffectivePermissions(actor.id);
  if (!permissions.has("settings.integrations.manage")) forbidden();
  const status = getSafeIntegrationStatus();
  return <div className="space-y-6"><header><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a77b27]">Provider health</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Integrations</h1><p className="mt-1 text-sm text-slate-500">Safe configuration status only. Secret values are never displayed or editable.</p></header><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
    <SettingsStatusCard title="Private File Storage" provider={`${status.storage.provider} · ${status.storage.mode}`} status={status.storage.configured ? "Configured" : "Not configured"} detail={`Private KYC and profile-photo object storage. Region: ${status.storage.region}.`} />
    <SettingsStatusCard title="Email Provider" provider={status.email.provider} status="Not configured" detail={status.email.detail} />
    <SettingsStatusCard title="SMS Provider" provider={status.sms.provider} status="Not configured" detail={status.sms.detail} />
    <SettingsStatusCard title="Runtime Notifications" provider={status.runtimeNotifications.provider} status="Operational" detail={status.runtimeNotifications.detail} />
    <SettingsStatusCard title="Payment Provider" provider={status.payments.provider} status="Phase 8 pending" detail={status.payments.detail} />
  </div></div>;
}

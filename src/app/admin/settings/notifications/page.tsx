import Link from "next/link";
import { forbidden } from "next/navigation";
import { getUserEffectivePermissions, requirePermission } from "@/lib/auth/authorize";
import { getEmailProviderStatus } from "@/lib/settings/email-service";
import { SettingsStatusCard } from "@/components/settings-status-card";

export const dynamic = "force-dynamic";

export default async function NotificationSettingsPage() {
  const actor = await requirePermission("settings.view");
  const permissions = await getUserEffectivePermissions(actor.id);
  if (!permissions.has("settings.notifications.manage")) forbidden();
  const email = getEmailProviderStatus();
  return <div className="space-y-6"><header><p className="text-xs font-bold uppercase tracking-[.18em] text-[#a77b27]">Messaging</p><h1 className="mt-1 text-2xl font-bold text-slate-950">Notifications</h1><p className="mt-1 text-sm text-slate-500">Distinct status for templates, the in-app inbox, and outbound delivery.</p></header><div className="grid gap-4 md:grid-cols-3">
    <SettingsStatusCard title="Notification Templates" provider="Database configuration" status="Operational" detail="Template content and enablement remain managed in General & Operations settings."><Link href="/admin/settings" className="mt-4 inline-block text-xs font-semibold text-[#102646] underline decoration-[#c59b46] underline-offset-4">Open template management</Link></SettingsStatusCard>
    <SettingsStatusCard title="In-App Notification Inbox" provider="Runtime database records" status="Operational" detail="User-isolated runtime notification records are separate from template configuration."><Link href="/admin/notifications" className="mt-4 inline-block text-xs font-semibold text-[#102646] underline decoration-[#c59b46] underline-offset-4">Open notification inbox</Link></SettingsStatusCard>
    <SettingsStatusCard title="Email Delivery" provider={email.providerType} status={email.configured ? "Configured" : "Not configured"} detail={email.statusMessage} />
  </div></div>;
}

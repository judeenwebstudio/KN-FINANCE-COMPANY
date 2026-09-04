import Link from "next/link";
import { getUserAuthorizedBranchScope, getUserEffectivePermissions, requirePermission } from "@/lib/auth/authorize";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const actor = await requirePermission("settings.view");
  const [permissions, scope] = await Promise.all([getUserEffectivePermissions(actor.id), getUserAuthorizedBranchScope(actor.id)]);
  const links = [
    { href: "/admin/settings", label: "General & Operations", show: true },
    { href: "/admin/branches", label: "Branches", show: permissions.has("settings.branch.manage") && scope.global },
    { href: "/admin/settings/security", label: "Security & Access", show: true },
    { href: "/admin/settings/notifications", label: "Notifications", show: permissions.has("settings.notifications.manage") },
    { href: "/admin/settings/integrations", label: "Integrations", show: permissions.has("settings.integrations.manage") },
    { href: "/admin/settings/system", label: "System", show: permissions.has("settings.update") },
  ];
  return <div className="space-y-6">
    <nav aria-label="Settings sections" className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xs">
      {links.filter((link) => link.show).map((link) => <Link key={link.href} href={link.href} className="whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#102646] focus:outline-none focus:ring-2 focus:ring-[#c59b46]">{link.label}</Link>)}
    </nav>
    {children}
  </div>;
}

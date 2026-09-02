"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, BadgeDollarSign, Banknote,
  Bell, BellDot, Building2, Calculator, CalendarClock, ChartNoAxesCombined,
  ChevronDown, CircleDollarSign, HandCoins, Languages, Landmark, LayoutDashboard,
  LogOut, Menu, PanelLeftClose, ReceiptText, Search, Settings, User, UserCog,
  Users, WalletCards, X, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { memberNavigation, adminNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { BranchDTO, PortalKind, PortalUserDTO } from "@/types/portal";

const iconMap: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard, building: Building2, users: Users,
  loans: HandCoins, calendar: CalendarClock, receipt: ReceiptText,
  accounts: WalletCards, deposit: ArrowDownToLine, withdrawal: ArrowUpFromLine,
  transfer: ArrowLeftRight, expense: Banknote, "deposit-method": BadgeDollarSign,
  "withdraw-method": CircleDollarSign, bank: Landmark, "user-settings": UserCog,
  languages: Languages, reports: ChartNoAxesCombined, settings: Settings,
  calculator: Calculator, pending: BellDot,
};

type PortalShellProps = {
  children: React.ReactNode;
  user: PortalUserDTO;
  portal: PortalKind;
  branches?: BranchDTO[];
};

/* KN Finance brand tokens */
const NAV_ACTIVE =
  "bg-[#1a2e5a]/8 text-[#1a2e5a] shadow-[inset_0_0_0_1px_rgba(26,46,90,.10)] " +
  "before:absolute before:-left-0.5 before:h-5 before:w-0.5 before:rounded-full before:bg-[#b8962e]";
const NAV_IDLE =
  "text-slate-600 hover:bg-white hover:text-[#1a2e5a]";

export function PortalShell({ children, user, portal, branches = [] }: PortalShellProps) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const userMenuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function closeMenu(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) setUserMenuOpen(false);
    }
    document.addEventListener("mousedown", closeMenu);
    return () => document.removeEventListener("mousedown", closeMenu);
  }, []);

  const sidebar = <>
    {/* ── Brand header ── */}
    <div className={cn(
      "flex items-center justify-between border-b border-[#1a2e5a]/10 bg-white px-4",
      collapsed ? "h-[60px]" : "h-[84px]"
    )}>
      <Link
        href={portal === "Admin" ? "/admin/dashboard" : "/member/dashboard"}
        className="flex min-w-0 items-center"
        aria-label="KN Finance Company — home"
      >
        {collapsed ? (
          /* Collapsed: small navy square with gold KN monogram */
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#1a2e5a] text-white shadow-sm">
            <svg viewBox="0 0 40 28" fill="none" className="w-7" aria-hidden="true">
              <text x="1" y="22" fontFamily="Georgia, serif" fontWeight="bold" fontSize="22" fill="white">KN</text>
            </svg>
          </span>
        ) : (
          /* Expanded: full transparent logo, contain, no crop */
          <Image
            src="/branding/kn-finance-logo.png"
            alt="KN Finance Company — Empowering your future"
            width={760}
            height={420}
            className="w-[168px] h-auto object-contain object-left"
            priority
          />
        )}
      </Link>
      <button className="lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation"><X /></button>
    </div>

    {/* ── Navigation ── */}
    <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4">
      {portal === "Admin"
        ? adminNavItems
            .filter((item) => !item.permission || (user.permissions && user.permissions.includes(item.permission)))
            .map((item) => {
              const Icon = iconMap[item.icon] ?? LayoutDashboard;
              const active = path === item.href || path.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                    active ? NAV_ACTIVE : NAV_IDLE
                  )}
                >
                  <Icon className="size-[18px] shrink-0" />
                  {!collapsed && item.name}
                </Link>
              );
            })
        : memberNavigation.map(([label, href, iconName]) => {
            const Icon = iconMap[iconName] ?? LayoutDashboard;
            const active = path === href || path.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                title={collapsed ? label : undefined}
                className={cn(
                  "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  active ? NAV_ACTIVE : NAV_IDLE
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {!collapsed && label}
              </Link>
            );
          })}
    </nav>

    {/* ── User card ── */}
    <div className="border-t border-slate-200/70 bg-white/70 p-3">
      <div className={cn("flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white p-2.5", collapsed && "justify-center p-2")}>
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#1a2e5a]/10 text-sm font-bold text-[#1a2e5a]">{user.name.slice(0, 2).toUpperCase()}</div>
        {!collapsed && <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-800">{user.name}</p><p className="truncate text-[11px] text-slate-500">{user.role.replaceAll("_", " ")}</p></div>}
      </div>
    </div>
  </>;

  return <div className="min-h-screen">
    <aside className={cn("fixed inset-y-0 left-0 z-40 hidden border-r border-slate-200/80 bg-slate-50/90 transition-[width] duration-200 lg:flex lg:flex-col", collapsed ? "w-20" : "w-64")}>{sidebar}</aside>
    {mobileOpen && <div className="fixed inset-0 z-50 bg-slate-950/40 lg:hidden"><aside className="flex h-full w-72 flex-col bg-white">{sidebar}</aside></div>}
    <div className={cn("transition-[padding]", collapsed ? "lg:pl-20" : "lg:pl-64")}>
      <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-slate-200/80 bg-white/95 px-4 shadow-[0_1px_6px_rgba(15,23,42,.03)] backdrop-blur md:px-6">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open navigation"><Menu /></Button>
        <Button variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={() => setCollapsed(!collapsed)} aria-label="Collapse navigation"><PanelLeftClose className={cn(collapsed && "rotate-180")} /></Button>
        <div className="relative hidden max-w-sm flex-1 md:block"><Search className="absolute left-3 top-2.5 size-4 text-slate-400" /><input aria-label="Search" className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/80 pl-9 pr-3 text-sm transition-colors placeholder:text-slate-400 hover:border-slate-300 focus:border-[#1a2e5a] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1a2e5a]/10" placeholder={portal === "Admin" ? "Search members, loans, accounts…" : "Search loans, transactions…"} /></div>
        <div className="ml-auto flex items-center gap-2">
          {portal === "Admin" && branches.length > 0 && <select aria-label="Branch" value={selectedBranchId} onChange={(event) => setSelectedBranchId(event.target.value)} className="hidden h-10 max-w-52 rounded-xl border border-[#1a2e5a]/20 bg-[#1a2e5a]/5 px-3 text-sm font-medium text-[#1a2e5a] transition-colors hover:bg-[#1a2e5a]/10 sm:block">
            <option value="all">All branches</option>{branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} ({branch.code})</option>)}
          </select>}
          {portal === "Member" && <button className="hidden text-sm font-medium sm:block">EN <ChevronDown className="inline size-3" /></button>}
          <Button variant="ghost" size="icon" aria-label="Notifications" className="relative rounded-xl text-slate-500 hover:bg-amber-50 hover:text-amber-700"><Bell className="size-5" /><span className="absolute right-2 top-2 size-2 rounded-full bg-rose-500 ring-2 ring-white" /></Button>
          <div className="relative" ref={userMenuRef}>
            <button aria-label="User menu" aria-expanded={userMenuOpen} onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-[#1a2e5a]/5">
              <span className="grid size-8 place-items-center rounded-xl bg-[#1a2e5a]/10 text-xs font-bold text-[#1a2e5a] ring-1 ring-[#1a2e5a]/20">{user.name.slice(0, 2).toUpperCase()}</span>
              <span className="hidden text-left md:block"><span className="block text-xs font-semibold">{user.name}</span><span className="block text-[10px] text-slate-500">{portal} portal</span></span>
              <ChevronDown className="hidden size-3 md:block" />
            </button>
            {userMenuOpen && <div role="menu" className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-[0_14px_40px_rgba(15,23,42,.14)] animate-in fade-in zoom-in-95 duration-150">
              <div className="border-b px-3 py-2"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-slate-500">{user.email}</p></div>
              <Link role="menuitem" href={portal === "Admin" ? "/admin/settings" : "/member/reports"} className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50"><User className="size-4" />Profile</Link>
              <button role="menuitem" onClick={() => signOut({ callbackUrl: "/login" })} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"><LogOut className="size-4" />Sign out</button>
            </div>}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1720px] p-4 sm:p-5 md:p-7 lg:p-8">{children}</main>
    </div>
  </div>;
}

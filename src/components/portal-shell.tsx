"use client";

import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, BadgeIndianRupee, Banknote,
  Bell, BellDot, Building2, Calculator, CalendarClock, ChartNoAxesCombined,
  ChevronDown, HandCoins, IndianRupee, Languages, Landmark, LayoutDashboard,
  LogOut, Menu, PanelLeftClose, ReceiptText, Search, Settings, User, UserCog,
  UserRound, Users, WalletCards, X, type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { memberNavigation, adminNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import type { BranchDTO, PortalKind, PortalUserDTO } from "@/types/portal";

const iconMap: Record<string, LucideIcon> = {
  "layout-dashboard": LayoutDashboard, building: Building2, users: Users,
  loans: HandCoins, calendar: CalendarClock, receipt: ReceiptText,
  accounts: WalletCards, deposit: ArrowDownToLine, withdrawal: ArrowUpFromLine,
  transfer: ArrowLeftRight, expense: Banknote, "deposit-method": BadgeIndianRupee,
  "withdraw-method": IndianRupee, bank: Landmark, "user-settings": UserCog,
  languages: Languages, reports: ChartNoAxesCombined, settings: Settings,
  calculator: Calculator, pending: BellDot,
};

type PortalShellProps = {
  children: React.ReactNode;
  user: PortalUserDTO;
  portal: PortalKind;
  branches?: BranchDTO[];
};

/* KN Finance Centralized Shell Navigation Styling Tokens */
const NAV_ACTIVE =
  "bg-shell-navy-active text-white shadow-xs font-semibold " +
  "before:absolute before:left-0 before:top-2 before:bottom-2 before:w-[3.5px] before:rounded-r-full before:bg-shell-gold";
const NAV_IDLE =
  "text-slate-300 hover:bg-shell-navy-hover hover:text-white";

export function PortalShell({ children, user, portal, branches = [] }: PortalShellProps) {
  const path = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [selectedBranchId, setSelectedBranchId] = useState("all");
  const [notifSummary, setNotifSummary] = useState<{ unreadCount: number; recentNotifications: Array<{ id: string; eventKey: string; title: string; message: string; readAt: string | null; createdAt: string; targetUrl?: string | null }> } | null>(null);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    import("@/app/notifications/actions").then(({ getNavbarNotificationSummaryAction }) => {
      getNavbarNotificationSummaryAction().then((res) => {
        if (mounted && res.success && res.data) {
          setNotifSummary(res.data);
        }
      });
    });
    return () => {
      mounted = false;
    };
  }, [path]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (!userMenuRef.current?.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
      if (!notifMenuRef.current?.contains(event.target as Node)) {
        setNotifMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setUserMenuOpen(false);
        setNotifMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const sidebar = (
    <>
      {/* ── Brand header ── */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-shell-border bg-white px-4 shrink-0 transition-[height] duration-200",
          collapsed ? "h-[60px]" : "h-[84px]"
        )}
      >
        <Link
          href={portal === "Admin" ? "/admin/dashboard" : "/member/dashboard"}
          className="flex min-w-0 items-center"
          aria-label="KN Finance Company — home"
        >
          {collapsed ? (
            /* Collapsed: gold/navy branded avatar */
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-shell-navy text-shell-gold-light border border-shell-gold/40 shadow-xs">
              <span className="font-serif font-bold text-base text-shell-gold-light">KN</span>
            </span>
          ) : (
            /* Expanded: official logo on clean white background */
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
        <button
          className="lg:hidden text-slate-600 hover:text-slate-900 p-1"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* ── Dark Navigation Menu ── */}
      <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-4 dark-sidebar-scroll">
        {portal === "Admin"
          ? adminNavItems
              .filter((item) =>
                (!item.permission || (user.permissions && user.permissions.includes(item.permission))) &&
                (!item.requiresGlobalBranchAccess || user.hasGlobalBranchAccess)
              )
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
                      "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors duration-150",
                      active ? NAV_ACTIVE : NAV_IDLE
                    )}
                  >
                    <Icon className={cn("size-[18px] shrink-0", active ? "text-shell-gold-light" : "text-slate-400")} />
                    {!collapsed && <span>{item.name}</span>}
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
                    "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-medium transition-colors duration-150",
                    active ? NAV_ACTIVE : NAV_IDLE
                  )}
                >
                  <Icon className={cn("size-[18px] shrink-0", active ? "text-shell-gold-light" : "text-slate-400")} />
                  {!collapsed && <span>{label}</span>}
                </Link>
              );
            })}
      </nav>

      {/* ── Dark Sidebar User Card ── */}
      <div className="border-t border-shell-border bg-shell-navy p-3 shrink-0">
        <div className={cn("flex items-center gap-3 rounded-xl border border-shell-border-subtle bg-shell-navy-surface p-2.5 shadow-xs", collapsed && "justify-center p-2")}>
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-shell-gold/20 text-shell-gold-light border border-shell-gold/30">
            <UserRound className="size-4.5 text-shell-gold-light" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{user.name}</p>
              <p className="truncate text-[10px] font-medium text-slate-400">{user.role.replaceAll("_", " ")}</p>
            </div>
          )}
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#f7f8fc]">
      {/* ── Desktop Dark Sidebar ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r border-shell-border bg-gradient-to-b from-shell-navy via-[#09182b] to-shell-navy-surface transition-[width] duration-200 lg:flex lg:flex-col",
          collapsed ? "w-20" : "w-64"
        )}
      >
        {sidebar}
      </aside>

      {/* ── Mobile Sidebar Drawer ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs lg:hidden">
          <aside className="flex h-full w-72 flex-col bg-gradient-to-b from-shell-navy via-[#09182b] to-shell-navy-surface border-r border-shell-border">
            {sidebar}
          </aside>
        </div>
      )}

      {/* ── Main Layout Wrapper ── */}
      <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-20" : "lg:pl-64")}>
        {/* ── Premium Corporate Dark Top Navbar ── */}
        <header className="sticky top-0 z-30 flex h-[68px] items-center gap-3 border-b border-shell-border bg-shell-navy px-4 shadow-[0_2px_10px_rgba(0,0,0,0.15)] md:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden text-slate-300 hover:bg-shell-navy-elevated hover:text-white"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex text-slate-300 hover:bg-shell-navy-elevated hover:text-white"
            onClick={() => setCollapsed(!collapsed)}
            aria-label="Collapse navigation"
          >
            <PanelLeftClose className={cn("size-5 transition-transform duration-200", collapsed && "rotate-180")} />
          </Button>

          {/* Search Control */}
          <div className="relative hidden max-w-sm flex-1 md:block">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <input
              aria-label="Search"
              className="h-10 w-full rounded-xl border border-shell-border-subtle bg-shell-navy-surface pl-9 pr-3 text-xs text-white transition-colors placeholder:text-slate-400 hover:border-shell-border-hover focus:border-shell-gold focus:bg-shell-navy-elevated focus:outline-none focus:ring-2 focus:ring-shell-gold/20"
              placeholder={portal === "Admin" ? "Search members, loans, accounts…" : "Search loans, transactions…"}
            />
          </div>

          {/* Navbar Right Controls */}
          <div className="ml-auto flex items-center gap-2.5">
            {portal === "Admin" && branches.length > 0 && (
              <select
                aria-label="Branch"
                value={selectedBranchId}
                onChange={(event) => setSelectedBranchId(event.target.value)}
                className="hidden h-10 max-w-52 rounded-xl border border-shell-border-subtle bg-shell-navy-surface px-3 text-xs font-medium text-slate-200 transition-colors hover:border-shell-border-hover focus:border-shell-gold focus:outline-none sm:block"
              >
                <option value="all" className="bg-shell-navy-surface text-white">All branches</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id} className="bg-shell-navy-surface text-white">
                    {branch.name} ({branch.code})
                  </option>
                ))}
              </select>
            )}

            {portal === "Member" && (
              <button className="hidden text-xs font-medium text-slate-300 hover:text-white sm:block px-2 py-1 rounded-lg hover:bg-shell-navy-elevated">
                EN <ChevronDown className="inline size-3 ml-0.5" />
              </button>
            )}

            {/* Notification Popover Dropdown */}
            <div className="relative" ref={notifMenuRef}>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Notifications"
                aria-expanded={notifMenuOpen}
                onClick={() => setNotifMenuOpen(!notifMenuOpen)}
                className="relative rounded-xl text-slate-300 hover:bg-shell-navy-elevated hover:text-white"
              >
                <Bell className="size-5" />
                {notifSummary && notifSummary.unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 flex size-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white shadow-xs">
                    {notifSummary.unreadCount > 9 ? "9+" : notifSummary.unreadCount}
                  </span>
                )}
              </Button>

              {notifMenuOpen && (
                <div
                  role="dialog"
                  aria-label="Notifications popover"
                  className="absolute right-0 mt-2 w-80 origin-top-right rounded-xl border border-slate-200 bg-white p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-50"
                >
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <h3 className="text-xs font-bold text-slate-900">Notifications</h3>
                    <span className="text-[10px] font-semibold text-rose-600">
                      {notifSummary?.unreadCount || 0} unread
                    </span>
                  </div>

                  {!notifSummary || notifSummary.recentNotifications.length === 0 ? (
                    <div className="py-6 text-center text-slate-500">
                      <Bell className="mx-auto size-7 text-slate-300 mb-2" />
                      <p className="text-xs font-semibold text-slate-700">No new notifications</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        System alerts and activity updates will appear here.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto py-2">
                      {notifSummary.recentNotifications.map((n) => (
                        <div key={n.id} className="py-2 px-1 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-900 truncate max-w-44">{n.title}</span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2 mt-0.5">{n.message}</p>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 text-center">
                    <Link
                      href={portal === "Admin" ? "/admin/notifications" : "/member/notifications"}
                      onClick={() => setNotifMenuOpen(false)}
                      className="text-[11px] font-bold text-[#275d4f] hover:underline"
                    >
                      View All Notifications &rarr;
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Profile Dropdown */}
            <div className="relative" ref={userMenuRef}>
              <button
                aria-label="User menu"
                aria-expanded={userMenuOpen}
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 rounded-xl p-1.5 transition-colors hover:bg-shell-navy-elevated"
              >
                <span className="grid size-8 place-items-center rounded-xl bg-shell-gold/20 text-shell-gold-light ring-1 ring-shell-gold/40">
                  <UserRound className="size-4 text-shell-gold-light" />
                </span>
                <span className="hidden text-left md:block">
                  <span className="block text-xs font-semibold text-white">{user.name}</span>
                  <span className="block text-[10px] font-medium text-slate-400">{portal} portal</span>
                </span>
                <ChevronDown className="hidden size-3.5 text-slate-400 md:block" />
              </button>

              {userMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 mt-2 w-64 origin-top-right rounded-xl border border-slate-200 bg-white p-2 shadow-2xl animate-in fade-in zoom-in-95 duration-150 z-50"
                >
                  <div className="border-b border-slate-100 px-3 py-2">
                    <p className="truncate text-xs font-bold text-slate-900">{user.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{user.email}</p>
                  </div>
                  <Link
                    role="menuitem"
                    href={portal === "Admin" ? "/admin/settings" : "/member/reports"}
                    onClick={() => setUserMenuOpen(false)}
                    className="mt-1 flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                  >
                    <User className="size-4 text-slate-500" /> Profile & Settings
                  </Link>
                  <button
                    role="menuitem"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    <LogOut className="size-4 text-red-500" /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ── Light Workspace Content Area ── */}
        <main className="mx-auto w-full max-w-[1720px] p-4 sm:p-5 md:p-7 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}

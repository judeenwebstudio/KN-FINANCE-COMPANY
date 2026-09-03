"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { updateGeneralSettingsAction, updateBrandingSettingsAction } from "./actions";
import { createBranchAction, updateBranchAction, toggleBranchStatusAction } from "./branch-actions";

export type CompanyProfileData = {
  id: string;
  legalName: string | null;
  displayName: string;
  tagline: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  licenseNumber: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  timezone: string | null;
  dateFormat: string;
  timeFormat: string;
  locale: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  metaDescription: string | null;
};

export type BranchOverviewData = {
  id: string;
  name: string;
  code: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  currency: string;
  status: string;
  userCount?: number;
  memberCount?: number;
  accountCount?: number;
  loanCount?: number;
};

export function SettingsClient({
  profile: initialProfile,
  branches: initialBranches,
  canManageCompany,
  canManageBranch,
  canManageFinancial,
}: {
  profile: CompanyProfileData;
  branches: BranchOverviewData[];
  canManageCompany: boolean;
  canManageBranch: boolean;
  canManageFinancial: boolean;
}) {
  const [profile, setProfile] = useState<CompanyProfileData>(initialProfile);
  const [branches, setBranches] = useState<BranchOverviewData[]>(initialBranches);
  const [activeTab, setActiveTab] = useState<"general" | "branding" | "branches" | "financial">("general");

  // General & Branding form states
  const [generalForm, setGeneralForm] = useState({
    displayName: profile.displayName || "KN Finance Company",
    legalName: profile.legalName || "",
    tagline: profile.tagline || "",
    registrationNumber: profile.registrationNumber || "",
    taxId: profile.taxId || "",
    licenseNumber: profile.licenseNumber || "",
    email: profile.email || "",
    phone: profile.phone || "",
    website: profile.website || "",
    address: profile.address || "",
    city: profile.city || "",
    state: profile.state || "",
    country: profile.country || "",
    timezone: profile.timezone || "UTC",
    dateFormat: profile.dateFormat || "YYYY-MM-DD",
    timeFormat: profile.timeFormat || "12h",
    locale: profile.locale || "en-US",
  });

  const [brandingForm, setBrandingForm] = useState({
    displayName: profile.displayName || "KN Finance Company",
    tagline: profile.tagline || "",
    logoUrl: profile.logoUrl || "/branding/kn-finance-logo.png",
    faviconUrl: profile.faviconUrl || "/favicon.ico",
    metaDescription: profile.metaDescription || "",
  });

  // Branch management modal states
  const [searchBranch, setSearchBranch] = useState("");
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<BranchOverviewData | null>(null);
  const [branchForm, setBranchForm] = useState({
    name: "",
    code: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    country: "",
    currency: "USD",
  });

  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [togglingBranchId, setTogglingBranchId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCompany) return;
    setIsSavingGeneral(true);
    setMessage(null);

    try {
      const res = await updateGeneralSettingsAction({
        ...generalForm,
        logoUrl: profile.logoUrl,
        faviconUrl: profile.faviconUrl,
        metaDescription: profile.metaDescription,
      });

      if (res.success && res.profile) {
        setProfile(res.profile as CompanyProfileData);
        setMessage({ type: "success", text: "General company settings updated successfully." });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update general settings." });
    } finally {
      setIsSavingGeneral(false);
    }
  };

  const handleBrandingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCompany) return;
    setIsSavingBranding(true);
    setMessage(null);

    try {
      const res = await updateBrandingSettingsAction({
        ...generalForm,
        displayName: brandingForm.displayName,
        tagline: brandingForm.tagline,
        logoUrl: brandingForm.logoUrl,
        faviconUrl: brandingForm.faviconUrl,
        metaDescription: brandingForm.metaDescription,
      });

      if (res.success && res.profile) {
        setProfile(res.profile as CompanyProfileData);
        setMessage({ type: "success", text: "Branding settings updated successfully." });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update branding settings." });
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleOpenCreateBranch = () => {
    setEditingBranch(null);
    setBranchForm({
      name: "",
      code: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      state: "",
      country: "",
      currency: "USD",
    });
    setIsBranchModalOpen(true);
  };

  const handleOpenEditBranch = (b: BranchOverviewData) => {
    setEditingBranch(b);
    setBranchForm({
      name: b.name,
      code: b.code,
      email: b.email,
      phone: b.phone,
      address: b.address,
      city: b.city,
      state: b.state,
      country: b.country,
      currency: b.currency || "USD",
    });
    setIsBranchModalOpen(true);
  };

  const handleBranchFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageBranch) return;
    setIsSavingBranch(true);
    setMessage(null);

    try {
      if (editingBranch) {
        const res = await updateBranchAction(editingBranch.id, branchForm);
        if (res.success && res.branch) {
          setBranches(branches.map((b) => (b.id === res.branch.id ? { ...b, ...res.branch } : b)));
          setMessage({ type: "success", text: `Branch '${res.branch.name}' (${res.branch.code}) updated successfully.` });
        }
      } else {
        const res = await createBranchAction(branchForm);
        if (res.success && res.branch) {
          setBranches([...branches, { ...res.branch, userCount: 0, memberCount: 0, accountCount: 0, loanCount: 0 }]);
          setMessage({ type: "success", text: `New branch '${res.branch.name}' (${res.branch.code}) created successfully.` });
        }
      }
      setIsBranchModalOpen(false);
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to save branch." });
    } finally {
      setIsSavingBranch(false);
    }
  };

  const handleToggleStatus = async (b: BranchOverviewData) => {
    if (!canManageBranch) return;
    if (b.code === "HQ-01" && b.status === "ACTIVE") {
      setMessage({ type: "error", text: "Headquarters branch (HQ-01) cannot be deactivated." });
      return;
    }

    const newStatus = b.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setTogglingBranchId(b.id);
    setMessage(null);

    try {
      const res = await toggleBranchStatusAction(b.id, newStatus);
      if (res.success && res.branch) {
        setBranches(branches.map((item) => (item.id === res.branch.id ? { ...item, status: res.branch.status } : item)));
        setMessage({ type: "success", text: `Branch '${b.name}' status set to ${newStatus}.` });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update branch status." });
    } finally {
      setTogglingBranchId(null);
    }
  };

  const filteredBranches = branches.filter(
    (b) =>
      b.name.toLowerCase().includes(searchBranch.toLowerCase()) ||
      b.code.toLowerCase().includes(searchBranch.toLowerCase()) ||
      b.city.toLowerCase().includes(searchBranch.toLowerCase())
  );

  const inputClass = `w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm focus:border-[#1a2e5a] focus:outline-none focus:ring-1 focus:ring-[#1a2e5a] disabled:bg-slate-100 disabled:text-slate-500`;
  const labelClass = `block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5`;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1a2e5a]">System Administration & Settings</h1>
          <p className="mt-1 text-sm text-slate-600">
            Centralized control panel for KN Finance Company.
          </p>
        </div>
        {!canManageCompany && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 border border-amber-200">
            <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H10m0-6h.01M12 3a9 9 0 100 18 9 9 0 000-18z" />
            </svg>
            Read-Only Mode (`settings.company.manage` required to edit)
          </span>
        )}
      </div>

      {/* Message Toast Banner */}
      {message && (
        <div
          className={`p-4 rounded-lg border text-sm flex items-center justify-between ${
            message.type === "success" ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"
          }`}
        >
          <span>{message.text}</span>
          <button onClick={() => setMessage(null)} className="font-bold ml-4 text-slate-500 hover:text-slate-900">
            ×
          </button>
        </div>
      )}

      {/* Tabs Header */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors ${
              activeTab === "general" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            🏢 General Settings
          </button>
          <button
            onClick={() => setActiveTab("branding")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors ${
              activeTab === "branding" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            🎨 Branding & Identity
          </button>
          <button
            onClick={() => setActiveTab("branches")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors ${
              activeTab === "branches" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            🏛️ Branches ({branches.length})
          </button>
          <button
            onClick={() => setActiveTab("financial")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors ${
              activeTab === "financial" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            💰 Financial Defaults
          </button>
        </nav>
      </div>

      {/* Tab 1: General Settings */}
      {activeTab === "general" && (
        <form onSubmit={handleGeneralSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Company Identity & Registration</h2>
            <p className="text-xs text-slate-500 mt-0.5">Manage legal identity, tax information, and business registration.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Company Display Name *</label>
              <input
                type="text"
                disabled={!canManageCompany}
                value={generalForm.displayName}
                onChange={(e) => setGeneralForm({ ...generalForm, displayName: e.target.value })}
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className={labelClass}>Legal Company Name</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="e.g. KN Finance Company LLC"
                value={generalForm.legalName}
                onChange={(e) => setGeneralForm({ ...generalForm, legalName: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Company Tagline</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="e.g. Empowering your future"
                value={generalForm.tagline}
                onChange={(e) => setGeneralForm({ ...generalForm, tagline: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Registration Number</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="Official business registration #"
                value={generalForm.registrationNumber}
                onChange={(e) => setGeneralForm({ ...generalForm, registrationNumber: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Tax ID / EIN</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="Tax identification number"
                value={generalForm.taxId}
                onChange={(e) => setGeneralForm({ ...generalForm, taxId: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Financial License Number</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="Regulatory license identifier"
                value={generalForm.licenseNumber}
                onChange={(e) => setGeneralForm({ ...generalForm, licenseNumber: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Corporate Contact & Location</h2>
            <p className="text-xs text-slate-500 mt-0.5">Primary corporate communications and address details.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            <div>
              <label className={labelClass}>Support Email</label>
              <input
                type="email"
                disabled={!canManageCompany}
                placeholder="support@knfinance.com"
                value={generalForm.email}
                onChange={(e) => setGeneralForm({ ...generalForm, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Phone Number</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="+1 (800) 000-0000"
                value={generalForm.phone}
                onChange={(e) => setGeneralForm({ ...generalForm, phone: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Website URL</label>
              <input
                type="url"
                disabled={!canManageCompany}
                placeholder="https://kn-finance-company.vercel.app"
                value={generalForm.website}
                onChange={(e) => setGeneralForm({ ...generalForm, website: e.target.value })}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className={labelClass}>Headquarters Street Address</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="Street address, suite or building"
                value={generalForm.address}
                onChange={(e) => setGeneralForm({ ...generalForm, address: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>City</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="City"
                value={generalForm.city}
                onChange={(e) => setGeneralForm({ ...generalForm, city: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>State / Province</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="State or Province"
                value={generalForm.state}
                onChange={(e) => setGeneralForm({ ...generalForm, state: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Country</label>
              <input
                type="text"
                disabled={!canManageCompany}
                placeholder="Country"
                value={generalForm.country}
                onChange={(e) => setGeneralForm({ ...generalForm, country: e.target.value })}
                className={inputClass}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h2 className="text-lg font-bold text-slate-900">Localization & Format Preferences</h2>
            <p className="text-xs text-slate-500 mt-0.5">System timezones, date formatting, and regional locale.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div>
              <label className={labelClass}>Timezone</label>
              <select
                disabled={!canManageCompany}
                value={generalForm.timezone}
                onChange={(e) => setGeneralForm({ ...generalForm, timezone: e.target.value })}
                className={inputClass}
              >
                <option value="UTC">UTC (Coordinated Universal Time)</option>
                <option value="America/New_York">America/New_York (EST/EDT)</option>
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Europe/London">Europe/London (GMT/BST)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Date Format</label>
              <select
                disabled={!canManageCompany}
                value={generalForm.dateFormat}
                onChange={(e) => setGeneralForm({ ...generalForm, dateFormat: e.target.value })}
                className={inputClass}
              >
                <option value="YYYY-MM-DD">YYYY-MM-DD (ISO standard)</option>
                <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                <option value="MM/DD/YYYY">MM/DD/YYYY</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Time Format</label>
              <select
                disabled={!canManageCompany}
                value={generalForm.timeFormat}
                onChange={(e) => setGeneralForm({ ...generalForm, timeFormat: e.target.value })}
                className={inputClass}
              >
                <option value="12h">12-hour (1:30 PM)</option>
                <option value="24h">24-hour (13:30)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Locale</label>
              <select
                disabled={!canManageCompany}
                value={generalForm.locale}
                onChange={(e) => setGeneralForm({ ...generalForm, locale: e.target.value })}
                className={inputClass}
              >
                <option value="en-US">English (US)</option>
                <option value="en-GB">English (UK)</option>
                <option value="en-IN">English (India)</option>
              </select>
            </div>
          </div>

          {canManageCompany && (
            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="submit"
                disabled={isSavingGeneral}
                className="rounded-lg bg-[#1a2e5a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#152548] focus:outline-none focus:ring-2 focus:ring-[#1a2e5a] disabled:opacity-50"
              >
                {isSavingGeneral ? "Saving..." : "Save General Settings"}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Tab 2: Branding & Identity */}
      {activeTab === "branding" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleBrandingSubmit} className="lg:col-span-2 space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Official Brand Assets & Metadata</h2>
              <p className="text-xs text-slate-500 mt-0.5">Configure official brand logo, icon, and application metadata.</p>
            </div>

            <div className="space-y-4">
              <div>
                <label className={labelClass}>App Display Title</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={brandingForm.displayName}
                  onChange={(e) => setBrandingForm({ ...brandingForm, displayName: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>App Tagline</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={brandingForm.tagline}
                  onChange={(e) => setBrandingForm({ ...brandingForm, tagline: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Official Logo Asset Path</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={brandingForm.logoUrl}
                  onChange={(e) => setBrandingForm({ ...brandingForm, logoUrl: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Favicon Asset Path</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={brandingForm.faviconUrl}
                  onChange={(e) => setBrandingForm({ ...brandingForm, faviconUrl: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Metadata SEO Description</label>
                <textarea
                  rows={3}
                  disabled={!canManageCompany}
                  value={brandingForm.metaDescription}
                  onChange={(e) => setBrandingForm({ ...brandingForm, metaDescription: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            {canManageCompany && (
              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingBranding}
                  className="rounded-lg bg-[#1a2e5a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#152548] focus:outline-none focus:ring-2 focus:ring-[#1a2e5a] disabled:opacity-50"
                >
                  {isSavingBranding ? "Saving..." : "Save Branding Settings"}
                </button>
              </div>
            )}
          </form>

          {/* Branding Preview Card */}
          <div className="space-y-4 bg-slate-900 p-6 rounded-xl border border-slate-800 text-white">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#b8962e]">Live Brand Preview</h3>

            <div className="rounded-lg bg-[#1a2e5a] p-5 shadow-lg border border-[#b8962e]/30 space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 relative bg-white rounded-md p-1 flex items-center justify-center">
                  <Image
                    src={brandingForm.logoUrl || "/branding/kn-finance-logo.png"}
                    alt={brandingForm.displayName}
                    width={36}
                    height={36}
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <div>
                  <h4 className="font-bold text-white text-base tracking-tight">{brandingForm.displayName}</h4>
                  <p className="text-xs text-[#b8962e] font-medium">{brandingForm.tagline || "Empowering your future"}</p>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 space-y-2 pt-2 border-t border-slate-800">
              <p><strong className="text-slate-300">Brand Colors:</strong> Navy (`#1a2e5a`) & Gold (`#b8962e`)</p>
              <p><strong className="text-slate-300">Favicon Path:</strong> `{brandingForm.faviconUrl}`</p>
              <p className="line-clamp-2"><strong className="text-slate-300">SEO Description:</strong> {brandingForm.metaDescription}</p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Branches Management */}
      {activeTab === "branches" && (
        <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Branch Directory & Operational Status</h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage operational branches and physical offices linked to financial ledgers.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search branches..."
                value={searchBranch}
                onChange={(e) => setSearchBranch(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-[#1a2e5a] focus:outline-none"
              />
              {canManageBranch && (
                <button
                  onClick={handleOpenCreateBranch}
                  className="rounded-lg bg-[#1a2e5a] px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#152548] focus:outline-none"
                >
                  + Add New Branch
                </button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Branch Name</th>
                  <th className="px-4 py-3 text-left">Contact Info</th>
                  <th className="px-4 py-3 text-left">Location</th>
                  <th className="px-4 py-3 text-center">Entity Scope</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  {canManageBranch && <th className="px-4 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredBranches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-bold text-[#1a2e5a]">{b.code}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{b.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{b.email}</div>
                      <div className="text-xs text-slate-400">{b.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.city}, {b.state}, {b.country}</td>
                    <td className="px-4 py-3 text-center text-xs space-x-1">
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        👥 {b.userCount ?? 0} users
                      </span>
                      <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        💳 {b.accountCount ?? 0} accs
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          b.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    {canManageBranch && (
                      <td className="px-4 py-3 text-right space-x-2">
                        <button
                          onClick={() => handleOpenEditBranch(b)}
                          className="text-xs font-semibold text-[#1a2e5a] hover:underline"
                        >
                          Edit
                        </button>
                        {b.code !== "HQ-01" && (
                          <button
                            onClick={() => handleToggleStatus(b)}
                            disabled={togglingBranchId === b.id}
                            className={`text-xs font-semibold ${
                              b.status === "ACTIVE" ? "text-rose-600 hover:underline" : "text-emerald-600 hover:underline"
                            }`}
                          >
                            {b.status === "ACTIVE" ? "Deactivate" : "Activate"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Financial Defaults */}
      {activeTab === "financial" && (
        <div className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Financial Accounting & Base Currency Defaults</h2>
              <p className="text-xs text-slate-500 mt-0.5">Read-only accounting rules enforcing ledger safety across historical transactions.</p>
            </div>
            {!canManageFinancial && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 border border-amber-200">
                🔒 Restricted (`settings.financial.manage`)
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Currency</span>
                <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
                  LOCKED
                </span>
              </div>
              <p className="text-3xl font-extrabold text-[#1a2e5a]">USD ($)</p>
              <p className="text-xs text-slate-600">
                Single-currency ledger rule. Base currency changes are locked to prevent reinterpreting historical financial balances.
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monetary Precision</span>
                <span className="inline-flex rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-bold text-slate-700">
                  SCHEMA FIXED
                </span>
              </div>
              <p className="text-3xl font-extrabold text-[#1a2e5a]">2 Decimals</p>
              <p className="text-xs text-slate-600">
                Internal storage utilizes PostgreSQL `Decimal(19,4)`. Currency formatting displays 2 decimal places (`$0.00`).
              </p>
            </div>

            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Processing Fee Engine</span>
                <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                  ACTIVE
                </span>
              </div>
              <p className="text-xl font-bold text-slate-900 mt-1">Product & Policy Level</p>
              <p className="text-xs text-slate-600">
                Processing fees are defined on dedicated Loan Products and Account Type Policies to preserve ledger integrity.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-xl bg-slate-900 text-white space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#b8962e]">Dedicated Fee & Product Modules</h3>
            <p className="text-xs text-slate-300">
              To configure specific loan product processing fees, penalty rules, or account minimum opening balances, use the dedicated management modules:
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              <Link
                href="/admin/loan-products"
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#1a2e5a] px-4 py-2 text-xs font-semibold text-white border border-[#b8962e]/40 hover:bg-[#152548]"
              >
                Manage Loan Product Fees →
              </Link>
              <Link
                href="/admin/account-types"
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white border border-slate-700 hover:bg-slate-700"
              >
                Manage Account Type Policies →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Branch Create / Edit Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-3">
              <h3 className="text-lg font-bold text-[#1a2e5a]">
                {editingBranch ? `Edit Branch: ${editingBranch.name} (${editingBranch.code})` : "Create New Branch"}
              </h3>
              <button onClick={() => setIsBranchModalOpen(false)} className="text-slate-400 hover:text-slate-700 font-bold">
                ×
              </button>
            </div>

            <form onSubmit={handleBranchFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Branch Code *</label>
                  <input
                    type="text"
                    required
                    disabled={!!editingBranch}
                    placeholder="e.g. HQ-02"
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                    className={inputClass}
                  />
                  {editingBranch && (
                    <p className="text-[10px] text-slate-400 mt-1">Branch code is immutable after creation.</p>
                  )}
                </div>
                <div>
                  <label className={labelClass}>Branch Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. North City Branch"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Branch Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="branch@knfinance.com"
                    value={branchForm.email}
                    onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone Number *</label>
                  <input
                    type="text"
                    required
                    placeholder="+1 (800) 000-0000"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className={labelClass}>Street Address *</label>
                <input
                  type="text"
                  required
                  placeholder="Street address"
                  value={branchForm.address}
                  onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className={labelClass}>City *</label>
                  <input
                    type="text"
                    required
                    placeholder="City"
                    value={branchForm.city}
                    onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>State *</label>
                  <input
                    type="text"
                    required
                    placeholder="State"
                    value={branchForm.state}
                    onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Country *</label>
                  <input
                    type="text"
                    required
                    placeholder="Country"
                    value={branchForm.country}
                    onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBranch}
                  className="rounded-lg bg-[#1a2e5a] px-5 py-2 text-xs font-semibold text-white hover:bg-[#152548] disabled:opacity-50"
                >
                  {isSavingBranch ? "Saving..." : editingBranch ? "Update Branch" : "Create Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

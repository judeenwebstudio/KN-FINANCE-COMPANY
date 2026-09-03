"use client";

import { useState } from "react";
import Image from "next/image";
import { updateGeneralSettingsAction, updateBrandingSettingsAction } from "./actions";

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
};

export function SettingsClient({
  profile: initialProfile,
  branches,
  canManageCompany,
}: {
  profile: CompanyProfileData;
  branches: BranchOverviewData[];
  canManageCompany: boolean;
}) {
  const [profile, setProfile] = useState<CompanyProfileData>(initialProfile);
  const [activeTab, setActiveTab] = useState<"general" | "branding" | "branches" | "financial">("general");

  // Form states
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

  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
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
          <button onClick={() => setMessage(null)} className="font-bold ml-4">
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

      {/* Tab 3: Branches Overview */}
      {activeTab === "branches" && (
        <div className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Branch Directory & Status</h2>
            <p className="text-xs text-slate-500 mt-0.5">Operational branches linked to existing financial ledgers.</p>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-700 font-semibold uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Code</th>
                  <th className="px-4 py-3 text-left">Branch Name</th>
                  <th className="px-4 py-3 text-left">Contact Email / Phone</th>
                  <th className="px-4 py-3 text-left">Address</th>
                  <th className="px-4 py-3 text-left">Currency</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {branches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-[#1a2e5a]">{b.code}</td>
                    <td className="px-4 py-3 font-bold text-slate-900">{b.name}</td>
                    <td className="px-4 py-3 text-slate-600">
                      <div>{b.email}</div>
                      <div className="text-xs text-slate-400">{b.phone}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{b.address}, {b.city}, {b.state}, {b.country}</td>
                    <td className="px-4 py-3 font-mono text-slate-800">{b.currency}</td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        {b.status}
                      </span>
                    </td>
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
          <div>
            <h2 className="text-lg font-bold text-slate-900">Financial Ledger & Accounting Defaults</h2>
            <p className="text-xs text-slate-500 mt-0.5">Read-only accounting rules enforcing financial ledger safety.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Base Currency</span>
              <p className="text-2xl font-bold text-[#1a2e5a] mt-1">USD ($)</p>
              <p className="text-xs text-slate-500 mt-1">Single-currency ledger rule enforced across all branches.</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Monetary Decimal Precision</span>
              <p className="text-2xl font-bold text-[#1a2e5a] mt-1">2 Decimals ($0.00)</p>
              <p className="text-xs text-slate-500 mt-1">Prisma Decimal(19,4) internal precision, formatted to 2 decimals.</p>
            </div>
            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accounting Safety Rule</span>
              <p className="text-2xl font-bold text-emerald-700 mt-1">LOCKED</p>
              <p className="text-xs text-slate-500 mt-1">Historical ledger entries remain immutable upon display settings change.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

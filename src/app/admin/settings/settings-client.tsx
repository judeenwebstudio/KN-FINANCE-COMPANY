"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  updateGeneralSettingsAction,
  updateBrandingSettingsAction,
  uploadBrandingAssetAction,
  restoreBrandingDefaultAction,
} from "./actions";
import { createBranchAction, updateBranchAction, toggleBranchStatusAction } from "./branch-actions";
import { updateEmailSettingsAction, sendTestEmailAction } from "./email-actions";
import {
  updateNotificationTemplateAction,
  toggleNotificationTemplateStatusAction,
  getTemplatePreviewAction,
} from "./notification-actions";

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

export type EmailConfigData = {
  id: string;
  enabled: boolean;
  provider: string;
  senderName: string;
  senderEmail: string | null;
  replyToEmail: string | null;
};

export type ProviderStatusData = {
  configured: boolean;
  providerType: string;
  statusMessage: string;
};

export type NotificationTemplateData = {
  id: string;
  code: string;
  name: string;
  description: string;
  channel: string;
  subject: string;
  bodyTemplate: string;
  variables: string[];
  isEnabled: boolean;
};

export function SettingsClient({
  profile: initialProfile,
  branches: initialBranches,
  emailConfig: initialEmailConfig,
  providerStatus,
  templates: initialTemplates,
  publicBrandingStorageConfigured = false,
  canManageCompany,
  canManageBranch,
  canManageFinancial,
  canManageNotifications,
  canManageIntegrations,
}: {
  profile: CompanyProfileData;
  branches: BranchOverviewData[];
  emailConfig: EmailConfigData;
  providerStatus: ProviderStatusData;
  templates: NotificationTemplateData[];
  publicBrandingStorageConfigured?: boolean;
  canManageCompany: boolean;
  canManageBranch: boolean;
  canManageFinancial: boolean;
  canManageNotifications: boolean;
  canManageIntegrations: boolean;
}) {
  const [profile, setProfile] = useState<CompanyProfileData>(initialProfile);
  const [branches, setBranches] = useState<BranchOverviewData[]>(initialBranches);
  const [emailConfig, setEmailConfig] = useState<EmailConfigData>(initialEmailConfig);
  const [templates, setTemplates] = useState<NotificationTemplateData[]>(initialTemplates);
  const [activeTab, setActiveTab] = useState<"general" | "branding" | "branches" | "financial" | "email" | "notifications">("general");

  // Message Toast Banner
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Upload States for Branding Assets
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [faviconPreviewUrl, setFaviconPreviewUrl] = useState<string | null>(null);
  const [isUploadingFavicon, setIsUploadingFavicon] = useState(false);
  const [showAdvancedBranding, setShowAdvancedBranding] = useState(false);

  const handleLogoFileChange = (file: File | null) => {
    if (!file) {
      setLogoFile(null);
      setLogoPreviewUrl(null);
      return;
    }
    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  };

  const handleFaviconFileChange = (file: File | null) => {
    if (!file) {
      setFaviconFile(null);
      setFaviconPreviewUrl(null);
      return;
    }
    setFaviconFile(file);
    setFaviconPreviewUrl(URL.createObjectURL(file));
  };

  const handleUploadAsset = async (kind: "logo" | "favicon") => {
    const file = kind === "logo" ? logoFile : faviconFile;
    if (!file) return;

    if (kind === "logo") setIsUploadingLogo(true);
    else setIsUploadingFavicon(true);

    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("kind", kind);
      formData.append("file", file);

      const res = await uploadBrandingAssetAction(formData);

      if (res.success && res.profile) {
        setProfile(res.profile as CompanyProfileData);
        setBrandingForm((prev) => ({
          ...prev,
          logoUrl: res.profile.logoUrl || prev.logoUrl,
          faviconUrl: res.profile.faviconUrl || prev.faviconUrl,
        }));

        if (kind === "logo") {
          setLogoFile(null);
          setLogoPreviewUrl(null);
        } else {
          setFaviconFile(null);
          setFaviconPreviewUrl(null);
        }

        setMessage({
          type: "success",
          text: `${kind === "logo" ? "Brand logo" : "Favicon"} uploaded and updated successfully.`,
        });
      } else {
        setMessage({
          type: "error",
          text: res.error || `Failed to upload ${kind}.`,
        });
      }
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : `Failed to upload ${kind}.`,
      });
    } finally {
      if (kind === "logo") setIsUploadingLogo(false);
      else setIsUploadingFavicon(false);
    }
  };

  const handleRestoreDefault = async (kind: "logo" | "favicon") => {
    if (!canManageCompany) return;
    setMessage(null);
    if (kind === "logo") setIsUploadingLogo(true);
    else setIsUploadingFavicon(true);

    try {
      const res = await restoreBrandingDefaultAction(kind);
      if (res.success && res.profile) {
        setProfile(res.profile as CompanyProfileData);
        setBrandingForm((prev) => ({
          ...prev,
          logoUrl: res.profile.logoUrl || prev.logoUrl,
          faviconUrl: res.profile.faviconUrl || prev.faviconUrl,
        }));
        if (kind === "logo") {
          setLogoFile(null);
          setLogoPreviewUrl(null);
        } else {
          setFaviconFile(null);
          setFaviconPreviewUrl(null);
        }
        setMessage({
          type: "success",
          text: `${kind === "logo" ? "Brand logo" : "Favicon"} restored to default.`,
        });
      } else {
        setMessage({ type: "error", text: "Failed to restore default asset." });
      }
    } catch (err: unknown) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to restore default asset.",
      });
    } finally {
      if (kind === "logo") setIsUploadingLogo(false);
      else setIsUploadingFavicon(false);
    }
  };

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
    locale: profile.locale || "en-IN",
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
    currency: "INR",
  });

  // Email Settings Form State
  const [emailForm, setEmailForm] = useState({
    enabled: emailConfig.enabled,
    senderName: emailConfig.senderName || "KN Finance Company",
    senderEmail: emailConfig.senderEmail || "",
    replyToEmail: emailConfig.replyToEmail || "",
  });
  const [testRecipient, setTestRecipient] = useState("");

  // Notification Template Modal & Preview States
  const [searchTemplate, setSearchTemplate] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<NotificationTemplateData | null>(null);
  const [templateForm, setTemplateForm] = useState({
    subject: "",
    bodyTemplate: "",
  });
  const [previewModal, setPreviewModal] = useState<{
    isOpen: boolean;
    templateName: string;
    subject: string;
    body: string;
    sampleData: Record<string, string>;
  } | null>(null);

  // Saving Loaders
  const [isSavingGeneral, setIsSavingGeneral] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);
  const [isSavingBranch, setIsSavingBranch] = useState(false);
  const [togglingBranchId, setTogglingBranchId] = useState<string | null>(null);
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);

  // General Submit
  const handleGeneralSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageCompany) return;
    setIsSavingGeneral(true);
    setMessage(null);

    try {
      const res = await updateGeneralSettingsAction({
        ...generalForm,
        displayName: generalForm.displayName,
      });

      if (res.success && res.profile) {
        setProfile(res.profile as CompanyProfileData);
        setMessage({ type: "success", text: "General settings updated successfully." });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update settings." });
    } finally {
      setIsSavingGeneral(false);
    }
  };

  // Branding Submit
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

  // Branch Handlers
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
      currency: "INR",
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
      currency: b.currency || "INR",
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

  // Email Settings Submit
  const handleEmailSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageIntegrations) return;
    setIsSavingEmail(true);
    setMessage(null);

    try {
      const res = await updateEmailSettingsAction(emailForm);
      if (res.success && res.config) {
        setEmailConfig(res.config as EmailConfigData);
        setMessage({ type: "success", text: "Email configuration updated successfully." });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update email settings." });
    } finally {
      setIsSavingEmail(false);
    }
  };

  // Send Test Email
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageIntegrations) return;
    if (!testRecipient || !testRecipient.includes("@")) {
      setMessage({ type: "error", text: "Please enter a valid recipient email address." });
      return;
    }
    setIsSendingTestEmail(true);
    setMessage(null);

    try {
      const res = await sendTestEmailAction(testRecipient);
      if (res.success) {
        setMessage({ type: "success", text: res.message });
      } else {
        setMessage({ type: "error", text: res.message });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to send test email." });
    } finally {
      setIsSendingTestEmail(false);
    }
  };

  // Notification Template Handlers
  const handleOpenEditTemplate = (t: NotificationTemplateData) => {
    setEditingTemplate(t);
    setTemplateForm({
      subject: t.subject,
      bodyTemplate: t.bodyTemplate,
    });
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManageNotifications || !editingTemplate) return;
    setIsSavingTemplate(true);
    setMessage(null);

    try {
      const res = await updateNotificationTemplateAction(editingTemplate.code, templateForm);
      if (res.success && res.template) {
        setTemplates(
          templates.map((item) =>
            item.code === res.template.code
              ? {
                  ...item,
                  subject: res.template.subject,
                  bodyTemplate: res.template.bodyTemplate,
                }
              : item
          )
        );
        setMessage({ type: "success", text: `Notification template '${editingTemplate.name}' updated successfully.` });
        setEditingTemplate(null);
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to update notification template." });
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleToggleTemplateStatus = async (t: NotificationTemplateData) => {
    if (!canManageNotifications) return;
    const newStatus = !t.isEnabled;
    setMessage(null);

    try {
      const res = await toggleNotificationTemplateStatusAction(t.code, newStatus);
      if (res.success && res.template) {
        setTemplates(
          templates.map((item) => (item.code === t.code ? { ...item, isEnabled: res.template.isEnabled } : item))
        );
        setMessage({
          type: "success",
          text: `Template '${t.name}' ${newStatus ? "enabled" : "disabled"}.`,
        });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to toggle template status." });
    }
  };

  const handleShowPreview = async (t: NotificationTemplateData) => {
    try {
      const res = await getTemplatePreviewAction(t.code, t.subject, t.bodyTemplate);
      if (res.success && res.preview) {
        setPreviewModal({
          isOpen: true,
          templateName: t.name,
          subject: res.preview.renderedSubject,
          body: res.preview.renderedBody,
          sampleData: res.preview.sampleDataUsed,
        });
      }
    } catch (err: unknown) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Failed to render preview." });
    }
  };

  // Filtered lists
  const filteredBranches = branches.filter(
    (b) =>
      (b?.name || "").toLowerCase().includes(searchBranch.toLowerCase()) ||
      (b?.code || "").toLowerCase().includes(searchBranch.toLowerCase()) ||
      (b?.city || "").toLowerCase().includes(searchBranch.toLowerCase()) ||
      (b?.country || "").toLowerCase().includes(searchBranch.toLowerCase())
  );

  const filteredTemplates = templates.filter(
    (t) =>
      (t?.name || "").toLowerCase().includes(searchTemplate.toLowerCase()) ||
      (t?.code || "").toLowerCase().includes(searchTemplate.toLowerCase()) ||
      (t?.description || "").toLowerCase().includes(searchTemplate.toLowerCase())
  );

  const labelClass = "block text-xs font-semibold uppercase tracking-wider text-slate-600 mb-1";
  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-sm focus:border-[#1a2e5a] focus:ring-1 focus:ring-[#1a2e5a] disabled:bg-slate-50 disabled:text-slate-500";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
      <div className="border-b border-slate-200 overflow-x-auto">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab("general")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === "general" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            🏢 General Settings
          </button>
          <button
            onClick={() => setActiveTab("branding")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === "branding" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            🎨 Branding & Identity
          </button>
          <button
            onClick={() => setActiveTab("branches")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === "branches" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            🏛️ Branches ({branches.length})
          </button>
          <button
            onClick={() => setActiveTab("financial")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === "financial" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            💰 Financial Defaults
          </button>
          <button
            onClick={() => setActiveTab("email")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === "email" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            ✉️ Email Configuration
          </button>
          <button
            onClick={() => setActiveTab("notifications")}
            className={`py-3.5 px-1 border-b-2 text-sm font-semibold transition-colors whitespace-nowrap ${
              activeTab === "notifications" ? "border-[#1a2e5a] text-[#1a2e5a]" : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            }`}
          >
            🔔 Notifications ({templates.length})
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
              <label className={labelClass}>Legal Entity Name</label>
              <input
                type="text"
                disabled={!canManageCompany}
                value={generalForm.legalName}
                onChange={(e) => setGeneralForm({ ...generalForm, legalName: e.target.value })}
                placeholder="e.g. KN Finance Company Ltd."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Tagline</label>
              <input
                type="text"
                disabled={!canManageCompany}
                value={generalForm.tagline}
                onChange={(e) => setGeneralForm({ ...generalForm, tagline: e.target.value })}
                placeholder="e.g. Empowering your future"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Registration Number</label>
              <input
                type="text"
                disabled={!canManageCompany}
                value={generalForm.registrationNumber}
                onChange={(e) => setGeneralForm({ ...generalForm, registrationNumber: e.target.value })}
                placeholder="Official Registration No."
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Tax ID / TIN</label>
              <input
                type="text"
                disabled={!canManageCompany}
                value={generalForm.taxId}
                onChange={(e) => setGeneralForm({ ...generalForm, taxId: e.target.value })}
                placeholder="Corporate Tax Identifier"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Financial License Number</label>
              <input
                type="text"
                disabled={!canManageCompany}
                value={generalForm.licenseNumber}
                onChange={(e) => setGeneralForm({ ...generalForm, licenseNumber: e.target.value })}
                placeholder="Regulatory License Identifier"
                className={inputClass}
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">Contact & Address Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              <div>
                <label className={labelClass}>Official Support Email</label>
                <input
                  type="email"
                  disabled={!canManageCompany}
                  value={generalForm.email}
                  onChange={(e) => setGeneralForm({ ...generalForm, email: e.target.value })}
                  placeholder="support@knfinance.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Official Phone Number</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={generalForm.phone}
                  onChange={(e) => setGeneralForm({ ...generalForm, phone: e.target.value })}
                  placeholder="+1 (800) 555-0199"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Corporate Website</label>
                <input
                  type="url"
                  disabled={!canManageCompany}
                  value={generalForm.website}
                  onChange={(e) => setGeneralForm({ ...generalForm, website: e.target.value })}
                  placeholder="https://knfinance.com"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label className={labelClass}>Physical Address</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={generalForm.address}
                  onChange={(e) => setGeneralForm({ ...generalForm, address: e.target.value })}
                  placeholder="Street Address"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>City</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
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
                  value={generalForm.country}
                  onChange={(e) => setGeneralForm({ ...generalForm, country: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 mb-3">System Regional & Date Formats</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className={labelClass}>System Timezone</label>
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
                  <option value="YYYY-MM-DD">YYYY-MM-DD (2026-09-03)</option>
                  <option value="DD/MM/YYYY">DD/MM/YYYY (03/09/2026)</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY (09/03/2026)</option>
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
                  <option value="12h">12-Hour (03:30 PM)</option>
                  <option value="24h">24-Hour (15:30)</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>System Locale</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={generalForm.locale}
                  onChange={(e) => setGeneralForm({ ...generalForm, locale: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {canManageCompany && (
            <div className="flex justify-end pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSavingGeneral}
                className="rounded-lg bg-[#1a2e5a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#122244] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1a2e5a] disabled:opacity-50"
              >
                {isSavingGeneral ? "Saving..." : "Save General Settings"}
              </button>
            </div>
          )}
        </form>
      )}

      {/* Tab 2: Branding Settings */}
      {activeTab === "branding" && (
        <div className="space-y-6">
          {/* Public Storage Status Notice */}
          {!publicBrandingStorageConfigured ? (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <span>⚠️ Public Branding Storage Not Configured</span>
              </div>
              <p>
                Custom branding uploads require <code className="font-mono bg-amber-100 px-1 py-0.5 rounded">PUBLIC_BRANDING_BLOB_READ_WRITE_TOKEN</code>. Custom uploads are disabled. Bundled defaults (<code className="font-mono">/branding/kn-finance-logo.png</code> & <code className="font-mono">/favicon.ico</code>) remain active. No file payloads will be stored as base64 or PostgreSQL blobs.
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center justify-between">
              <span className="font-semibold flex items-center gap-1.5">
                ✓ Public Branding Object Storage Configured (<code className="font-mono">PUBLIC_BRANDING_BLOB_STORE_ID</code>)
              </span>
              <span className="text-[11px] text-emerald-700 font-medium">Dedicated Public Store</span>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* 1. Logo Upload & Management Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Brand Logo</h3>
                    <p className="text-xs text-slate-500">Official company logo asset used in header, login & navigation.</p>
                  </div>
                  {canManageCompany && (
                    <button
                      type="button"
                      disabled={isUploadingLogo}
                      onClick={() => handleRestoreDefault("logo")}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline disabled:opacity-50"
                    >
                      Restore Default
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-5">
                  {/* Current or Pending Preview */}
                  <div className="relative size-20 rounded-xl border border-slate-200 bg-slate-900 p-2 shrink-0 overflow-hidden shadow-xs">
                    <Image
                      src={logoPreviewUrl || brandingForm.logoUrl || "/branding/kn-finance-logo.png"}
                      alt="Brand Logo"
                      fill
                      className="object-contain"
                      unoptimized
                    />
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-700">Upload New Logo (PNG, JPEG, WebP, max 5 MB)</label>
                    <input
                      type="file"
                      accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                      disabled={!canManageCompany || !publicBrandingStorageConfigured || isUploadingLogo}
                      onChange={(e) => handleLogoFileChange(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {logoFile && (
                      <p className="text-[11px] font-mono text-emerald-700">
                        Selected: {logoFile.name} ({(logoFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {logoFile && publicBrandingStorageConfigured && canManageCompany && (
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleLogoFileChange(null)}
                    disabled={isUploadingLogo}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUploadAsset("logo")}
                    disabled={isUploadingLogo}
                    className="px-4 py-1.5 rounded-lg bg-[#1a2e5a] text-xs font-semibold text-white hover:bg-[#122244] disabled:opacity-50 shadow-xs"
                  >
                    {isUploadingLogo ? "Uploading..." : "Upload & Apply Logo"}
                  </button>
                </div>
              )}
            </div>

            {/* 2. Favicon Upload & Management Card */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">Favicon & Browser Tab</h3>
                    <p className="text-xs text-slate-500">Browser tab icon & metadata shortcut icon.</p>
                  </div>
                  {canManageCompany && (
                    <button
                      type="button"
                      disabled={isUploadingFavicon}
                      onClick={() => handleRestoreDefault("favicon")}
                      className="text-xs font-semibold text-indigo-700 hover:text-indigo-900 hover:underline disabled:opacity-50"
                    >
                      Restore Default
                    </button>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-5">
                  {/* Current or Pending Preview Tab Simulation */}
                  <div className="rounded-t-lg bg-slate-200 border border-slate-300 p-1.5 shrink-0">
                    <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-t text-xs text-slate-800 font-medium max-w-[150px] truncate border-t border-x border-slate-300 shadow-xs">
                      <Image
                        src={faviconPreviewUrl || brandingForm.faviconUrl || "/favicon.ico"}
                        alt="Favicon"
                        width={16}
                        height={16}
                        className="size-4 object-contain rounded-xs shrink-0"
                        unoptimized
                      />
                      <span className="truncate text-[11px]">{brandingForm.displayName || "KN Finance"}</span>
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 min-w-0">
                    <label className="block text-xs font-semibold text-slate-700">Upload New Favicon (PNG, ICO, max 2 MB)</label>
                    <input
                      type="file"
                      accept=".png,.ico,image/png,image/x-icon,image/vnd.microsoft.icon"
                      disabled={!canManageCompany || !publicBrandingStorageConfigured || isUploadingFavicon}
                      onChange={(e) => handleFaviconFileChange(e.target.files?.[0] || null)}
                      className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {faviconFile && (
                      <p className="text-[11px] font-mono text-emerald-700">
                        Selected: {faviconFile.name} ({(faviconFile.size / 1024).toFixed(1)} KB)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {faviconFile && publicBrandingStorageConfigured && canManageCompany && (
                <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleFaviconFileChange(null)}
                    disabled={isUploadingFavicon}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUploadAsset("favicon")}
                    disabled={isUploadingFavicon}
                    className="px-4 py-1.5 rounded-lg bg-[#1a2e5a] text-xs font-semibold text-white hover:bg-[#122244] disabled:opacity-50 shadow-xs"
                  >
                    {isUploadingFavicon ? "Uploading..." : "Upload & Apply Favicon"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* 3. Brand Copy Form */}
          <form onSubmit={handleBrandingSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3">Brand Name, Tagline & Meta Description</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className={labelClass}>Company Display Name *</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={brandingForm.displayName}
                  onChange={(e) => setBrandingForm({ ...brandingForm, displayName: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Tagline</label>
                <input
                  type="text"
                  disabled={!canManageCompany}
                  value={brandingForm.tagline}
                  onChange={(e) => setBrandingForm({ ...brandingForm, tagline: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label className={labelClass}>Meta Description</label>
              <textarea
                rows={2}
                disabled={!canManageCompany}
                value={brandingForm.metaDescription}
                onChange={(e) => setBrandingForm({ ...brandingForm, metaDescription: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 shadow-xs focus:border-[#1a2e5a] focus:ring-1 focus:ring-[#1a2e5a] disabled:opacity-60"
              />
            </div>

            {canManageCompany && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSavingBranding}
                  className="rounded-lg bg-[#1a2e5a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#122244] disabled:opacity-50"
                >
                  {isSavingBranding ? "Saving..." : "Save Brand Details"}
                </button>
              </div>
            )}
          </form>

          {/* 4. Advanced Technical Details (Collapsible Read-Only Inspection) */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setShowAdvancedBranding((v) => !v)}
              className="text-xs font-bold text-slate-700 hover:text-slate-900 flex items-center gap-2"
            >
              <span>{showAdvancedBranding ? "▼ Hide" : "▶ Show"} Technical Asset Locations (Read-Only)</span>
            </button>
            {showAdvancedBranding && (
              <div className="mt-3 space-y-2 text-xs font-mono text-slate-600 bg-white p-3 rounded-lg border border-slate-200">
                <div>
                  <span className="font-bold text-slate-800">Logo Path / URL:</span>{" "}
                  <code className="text-indigo-700 break-all">{brandingForm.logoUrl}</code>
                </div>
                <div>
                  <span className="font-bold text-slate-800">Favicon Path / URL:</span>{" "}
                  <code className="text-indigo-700 break-all">{brandingForm.faviconUrl}</code>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Branches Directory */}
      {activeTab === "branches" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Branch Network Directory</h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage operational branches and check active entity count safeguards.</p>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder="Search branches..."
                value={searchBranch}
                onChange={(e) => setSearchBranch(e.target.value)}
                className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm text-slate-900"
              />
              {canManageBranch && (
                <button
                  onClick={handleOpenCreateBranch}
                  className="rounded-lg bg-[#1a2e5a] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#122244]"
                >
                  + Add New Branch
                </button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 uppercase tracking-wider border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Code & Name</th>
                  <th className="px-5 py-3">Location & Contact</th>
                  <th className="px-5 py-3">Currency</th>
                  <th className="px-5 py-3">Active Entities</th>
                  <th className="px-5 py-3">Status</th>
                  {canManageBranch && <th className="px-5 py-3 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredBranches.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="px-5 py-4">
                      <div className="font-bold text-slate-900 flex items-center gap-2">
                        <span>{b.name}</span>
                        {b.code === "HQ-01" && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                            HEADQUARTERS ANCHOR
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 font-mono">Code: {b.code}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="text-xs font-medium text-slate-900">{b.city}, {b.country}</div>
                      <div className="text-xs text-slate-500">{b.email} • {b.phone}</div>
                    </td>
                    <td className="px-5 py-4 font-mono font-bold text-slate-900">
                      {b.currency || "INR"}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">Users: {b.userCount ?? 0}</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">Accounts: {b.accountCount ?? 0}</span>
                        <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs">Loans: {b.loanCount ?? 0}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          b.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-rose-100 text-rose-800 border border-rose-200"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    {canManageBranch && (
                      <td className="px-5 py-4 text-right space-x-3">
                        <button
                          onClick={() => handleOpenEditBranch(b)}
                          className="font-medium text-[#1a2e5a] hover:underline"
                        >
                          Edit
                        </button>
                        {b.code !== "HQ-01" && (
                          <button
                            disabled={togglingBranchId === b.id}
                            onClick={() => handleToggleStatus(b)}
                            className={`font-medium ${
                              b.status === "ACTIVE" ? "text-rose-600 hover:underline" : "text-emerald-600 hover:underline"
                            } disabled:opacity-50`}
                          >
                            {togglingBranchId === b.id ? "Processing..." : b.status === "ACTIVE" ? "Deactivate" : "Activate"}
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
              <h2 className="text-lg font-bold text-slate-900">Financial System Configuration</h2>
              <p className="text-xs text-slate-500 mt-0.5">Centralized currency rules, precision defaults, and product policy references.</p>
            </div>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded border ${
                canManageFinancial
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-slate-50 text-slate-600 border-slate-200"
              }`}
            >
              {canManageFinancial ? "Financial Manage Access: Granted" : "Financial Manage Access: Read-Only"}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Base Currency</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">INR (₹)</div>
              <p className="text-xs text-slate-600 mt-2">
                KN Finance Company operates on a single-currency INR accounting ledger. Multi-currency translation is disabled.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Monetary Precision</span>
              <div className="text-2xl font-bold text-slate-900 mt-1">Decimal(19,4)</div>
              <p className="text-xs text-slate-600 mt-2">
                Financial balances are stored with 4 decimal places of internal precision and displayed to 2 decimals.
              </p>
            </div>
            <div className="p-5 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Product Management</span>
              <div className="text-sm font-semibold text-slate-900 mt-2">Loan & Account Policies</div>
              <div className="mt-3 space-y-1">
                <Link href="/admin/loan-products" className="block text-xs font-bold text-[#1a2e5a] hover:underline">
                  → Manage Loan Products
                </Link>
                <Link href="/admin/account-types" className="block text-xs font-bold text-[#1a2e5a] hover:underline">
                  → Manage Account Types
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Email Configuration (Phase 7C) */}
      {activeTab === "email" && (
        <div className="space-y-6">
          <form onSubmit={handleEmailSettingsSubmit} className="space-y-6 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Application Email Configuration</h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage non-secret sender identity and email dispatch settings.</p>
            </div>

            <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-slate-900">Administrative Email Dispatch Preference</div>
                <p className="text-xs text-slate-600 mt-0.5">Enable or disable system email preference. Delivery remains unavailable until a provider is installed.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  disabled={!canManageIntegrations}
                  checked={emailForm.enabled}
                  onChange={(e) => setEmailForm({ ...emailForm, enabled: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1a2e5a]"></div>
                <span className="ml-3 text-xs font-bold text-slate-700">
                  {emailForm.enabled ? "ENABLED (Preference)" : "DISABLED"}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={labelClass}>Sender Display Name *</label>
                <input
                  type="text"
                  disabled={!canManageIntegrations}
                  value={emailForm.senderName}
                  onChange={(e) => setEmailForm({ ...emailForm, senderName: e.target.value })}
                  placeholder="e.g. KN Finance Company"
                  className={inputClass}
                  required
                />
              </div>
              <div>
                <label className={labelClass}>Sender Email Address</label>
                <input
                  type="email"
                  disabled={!canManageIntegrations}
                  value={emailForm.senderEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, senderEmail: e.target.value })}
                  placeholder="Optional official sender address"
                  className={inputClass}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Reply-To Email Address</label>
                <input
                  type="email"
                  disabled={!canManageIntegrations}
                  value={emailForm.replyToEmail}
                  onChange={(e) => setEmailForm({ ...emailForm, replyToEmail: e.target.value })}
                  placeholder="Optional reply-to address"
                  className={inputClass}
                />
              </div>
            </div>

            {/* Provider Infrastructure Readiness Card */}
            <div className="pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-2">Provider Infrastructure Status</h3>
              <div className="p-4 rounded-xl border bg-slate-50 flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                    <span className="text-sm font-bold text-slate-900">
                      Provider: NONE (Not Configured)
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">No email delivery provider integration exists in the repository.</p>
                  <p className="text-[11px] text-slate-500 mt-1 font-mono">
                    Delivery Status: UNAVAILABLE
                  </p>
                </div>
                <span className="text-[11px] font-semibold text-slate-500 border border-slate-200 bg-white px-2.5 py-1 rounded">
                  Delivery Integration Deferred
                </span>
              </div>
            </div>

            {canManageIntegrations && (
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={isSavingEmail}
                  className="rounded-lg bg-[#1a2e5a] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#122244] disabled:opacity-50"
                >
                  {isSavingEmail ? "Saving..." : "Save Email Settings"}
                </button>
              </div>
            )}
          </form>

          {/* Test Email Dispatch Card */}
          <form onSubmit={handleSendTestEmail} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Send Diagnostic Test Email</h3>
              <p className="text-xs text-slate-500 mt-0.5">Test server delivery pipeline to a recipient address.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <input
                type="email"
                disabled={!canManageIntegrations || !providerStatus.configured}
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                placeholder="Enter recipient email address..."
                className="flex-1 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 disabled:bg-slate-50"
              />
              <button
                type="submit"
                disabled={!canManageIntegrations || !providerStatus.configured || isSendingTestEmail}
                className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50"
              >
                {isSendingTestEmail ? "Sending..." : "Send Test Email"}
              </button>
            </div>
            {!providerStatus.configured && (
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 p-2.5 rounded-lg">
                Email provider is not configured. Delivery is disabled until environment credentials are provided.
              </p>
            )}
          </form>
        </div>
      )}

      {/* Tab 6: Notifications & Templates (Phase 7C) */}
      {activeTab === "notifications" && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div>
              <h2 className="text-lg font-bold text-slate-900">System Notification Templates</h2>
              <p className="text-xs text-slate-500 mt-0.5">Manage event subject lines, plain text body templates, and placeholder allowlists.</p>
            </div>
            <input
              type="text"
              placeholder="Search templates..."
              value={searchTemplate}
              onChange={(e) => setSearchTemplate(e.target.value)}
              className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-sm text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 gap-5">
            {filteredTemplates.map((t) => (
              <div key={t.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-base">{t.name}</span>
                        <span className="font-mono text-xs font-semibold text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                          {t.code}
                        </span>
                        <span className="text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                          {t.channel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-1">{t.description}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          t.isEnabled ? "bg-emerald-100 text-emerald-800 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
                        }`}
                      >
                        {t.isEnabled ? "ACTIVE" : "INACTIVE"}
                      </span>
                      {canManageNotifications && (
                        <button
                          onClick={() => handleToggleTemplateStatus(t)}
                          className={`text-xs font-semibold hover:underline ${
                            t.isEnabled ? "text-rose-600" : "text-emerald-600"
                          }`}
                        >
                          {t.isEnabled ? "Disable" : "Enable"}
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5">
                    <div className="text-xs font-bold text-slate-900">
                      Subject: <span className="font-mono text-slate-700 font-normal">{t.subject}</span>
                    </div>
                    <div className="text-xs text-slate-600 font-mono whitespace-pre-wrap line-clamp-3">
                      {t.bodyTemplate}
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Allowed Placeholders Allowlist
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {t.variables.map((v) => (
                        <span key={v} className="bg-amber-50 text-amber-900 border border-amber-200 font-mono text-[11px] px-2 py-0.5 rounded">
                          {"{{"}
                          {v}
                          {"}}"}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => handleShowPreview(t)}
                    className="text-xs font-semibold text-[#1a2e5a] bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-md"
                  >
                    🔍 Live Safe Preview
                  </button>
                  {canManageNotifications && (
                    <button
                      onClick={() => handleOpenEditTemplate(t)}
                      className="text-xs font-semibold text-white bg-[#1a2e5a] hover:bg-[#122244] px-3.5 py-1.5 rounded-md"
                    >
                      ✏️ Edit Template
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Edit Branch Modal */}
      {isBranchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <h3 className="text-lg font-bold text-slate-900">
              {editingBranch ? `Edit Branch '${editingBranch.name}'` : "Create New Branch"}
            </h3>

            <form onSubmit={handleBranchFormSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelClass}>Branch Name *</label>
                  <input
                    type="text"
                    value={branchForm.name}
                    onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Branch Code * {editingBranch && <span className="text-rose-600 font-bold">(IMMUTABLE)</span>}
                  </label>
                  <input
                    type="text"
                    disabled={Boolean(editingBranch)}
                    value={branchForm.code}
                    onChange={(e) => setBranchForm({ ...branchForm, code: e.target.value.toUpperCase() })}
                    placeholder="e.g. DEL-02"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Branch Email *</label>
                  <input
                    type="email"
                    value={branchForm.email}
                    onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Phone *</label>
                  <input
                    type="text"
                    value={branchForm.phone}
                    onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelClass}>Address *</label>
                  <input
                    type="text"
                    value={branchForm.address}
                    onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>City *</label>
                  <input
                    type="text"
                    value={branchForm.city}
                    onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>State *</label>
                  <input
                    type="text"
                    value={branchForm.state}
                    onChange={(e) => setBranchForm({ ...branchForm, state: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Country *</label>
                  <input
                    type="text"
                    value={branchForm.country}
                    onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })}
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label className={labelClass}>Currency (Locked)</label>
                  <input
                    type="text"
                    disabled
                    value="INR"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsBranchModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingBranch}
                  className="rounded-lg bg-[#1a2e5a] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#122244] disabled:opacity-50"
                >
                  {isSavingBranch ? "Saving..." : "Save Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Notification Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Edit Template: {editingTemplate.name}</h3>
                <p className="text-xs text-slate-500 font-mono">Event Code: {editingTemplate.code}</p>
              </div>
              <button onClick={() => setEditingTemplate(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveTemplate} className="space-y-4">
              <div>
                <label className={labelClass}>Subject Line *</label>
                <input
                  type="text"
                  value={templateForm.subject}
                  onChange={(e) => setTemplateForm({ ...templateForm, subject: e.target.value })}
                  className={inputClass}
                  required
                />
              </div>

              <div>
                <label className={labelClass}>Body Template *</label>
                <textarea
                  rows={6}
                  value={templateForm.bodyTemplate}
                  onChange={(e) => setTemplateForm({ ...templateForm, bodyTemplate: e.target.value })}
                  className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm font-mono text-slate-900 shadow-sm focus:border-[#1a2e5a] focus:ring-1 focus:ring-[#1a2e5a]"
                  required
                />
              </div>

              <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 space-y-1">
                <span className="text-xs font-bold text-amber-900">Allowed Placeholders Allowlist</span>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {editingTemplate.variables.map((v) => (
                    <button
                      type="button"
                      key={v}
                      onClick={() =>
                        setTemplateForm({
                          ...templateForm,
                          bodyTemplate: `${templateForm.bodyTemplate} {{${v}}}`,
                        })
                      }
                      className="bg-white text-amber-900 border border-amber-300 font-mono text-[11px] px-2 py-0.5 rounded hover:bg-amber-100"
                    >
                      + {"{{"}
                      {v}
                      {"}}"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-amber-800 pt-1">
                  Click a placeholder to append it to the body. Unallowed placeholders will be rejected server-side.
                </p>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingTemplate(null)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingTemplate}
                  className="rounded-lg bg-[#1a2e5a] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#122244] disabled:opacity-50"
                >
                  {isSavingTemplate ? "Saving..." : "Save Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Safe Preview Modal */}
      {previewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-xl rounded-xl bg-white p-6 shadow-xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Safe Sample Preview</h3>
                <p className="text-xs text-slate-500">{previewModal.templateName}</p>
              </div>
              <button onClick={() => setPreviewModal(null)} className="text-slate-400 hover:text-slate-700 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Rendered Subject Line</span>
                <div className="text-sm font-bold text-slate-900 mt-1">{previewModal.subject}</div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-2">Rendered Body Text</span>
                <div className="text-xs text-slate-800 font-mono whitespace-pre-wrap leading-relaxed">
                  {previewModal.body}
                </div>
              </div>

              <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
                <span className="font-bold">Synthetic Preview Data:</span> Rendered strictly using safe sample data. No real members were queried or notified.
              </div>
            </div>

            <div className="flex justify-end pt-3">
              <button
                onClick={() => setPreviewModal(null)}
                className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

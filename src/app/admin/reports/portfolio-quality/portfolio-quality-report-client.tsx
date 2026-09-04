"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Building2, CheckCircle2, ShieldAlert, Filter, Printer } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { StatCard } from "@/components/stat-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MoneyDisplay, CurrencyBadge } from "@/components/money-display";
import type { PortfolioQualityReportResult } from "@/lib/reports/portfolio-quality-reports";

type Props = {
  initialReport: PortfolioQualityReportResult;
  branches: Array<{ id: string; name: string; code: string }>;
  products: Array<{ id: string; name: string; code: string }>;
};

export function PortfolioQualityReportClient({ initialReport, branches, products }: Props) {
  const [branchId, setBranchId] = useState("all");
  const [productId, setProductId] = useState("all");
  const [currency, setCurrency] = useState("all");
  const [report, setReport] = useState<PortfolioQualityReportResult>(initialReport);
  const [loading, setLoading] = useState(false);

  async function handleFilter() {
    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (branchId !== "all") query.set("branchId", branchId);
      if (productId !== "all") query.set("productId", productId);
      if (currency !== "all") query.set("currency", currency);

      const res = await fetch(`/api/admin/reports/portfolio-quality?${query.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setReport(data);
      }
    } catch (err) {
      console.error("Filter error:", err);
    } finally {
      setLoading(false);
    }
  }

  const firstPar = report.parSummaries[0];

  return (
    <>
      <div className="mb-2">
        <Link href="/admin/reports" className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:underline">
          <ArrowLeft className="size-3" /> Back to Report Hub
        </Link>
      </div>

      <PageHeader
        title="Portfolio Quality & Risk Report"
        description={`Authoritative Portfolio at Risk (PAR), aging distribution, collection rates, vintage cohorts, and operational provisioning estimates. As of current business date: ${report.asOfDate}`}
      />

      {/* Filter Bar */}
      <Card className="mb-6 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700">Branch Scope</label>
            <select
              aria-label="Branch Scope"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-800"
            >
              <option value="all">All Accessible Branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">Loan Product</label>
            <select
              aria-label="Loan Product"
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-800"
            >
              <option value="all">All Products</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name} ({p.code})</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700">ISO Currency</label>
            <select
              aria-label="ISO Currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2 text-xs font-medium text-slate-800"
            >
              <option value="INR">INR (₹)</option>
            </select>
          </div>

          <Button onClick={handleFilter} disabled={loading} className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-xs">
            <Filter className="mr-1 size-3.5" /> Filter Report
          </Button>

          <Button variant="outline" onClick={() => window.print()} className="ml-auto rounded-xl text-xs">
            <Printer className="mr-1 size-3.5" /> Print Report
          </Button>
        </div>
      </Card>

      {/* Summary Risk Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Active Facilities"
          value={firstPar ? firstPar.totalActiveLoans.toString() : "0"}
          hint="Active & defaulted exposure"
          icon={Building2}
          tone="indigo"
        />
        <StatCard
          label="PAR 30 Exposure"
          value={firstPar ? `${firstPar.par30Rate}%` : "0%"}
          hint={firstPar ? `₹${firstPar.par30Amount.toLocaleString()}` : "₹0"}
          icon={AlertTriangle}
          tone="amber"
        />
        <StatCard
          label="PAR 90+ Exposure"
          value={firstPar ? `${firstPar.par90Rate}%` : "0%"}
          hint={firstPar ? `₹${firstPar.par90Amount.toLocaleString()}` : "₹0"}
          icon={ShieldAlert}
          tone="rose"
        />
        <StatCard
          label="Overdue Principal"
          value={firstPar ? `₹${firstPar.totalOverduePrincipal.toLocaleString()}` : "₹0"}
          hint="Delinquent installment arrears"
          icon={AlertTriangle}
          tone="rose"
        />
        <StatCard
          label="Outstanding Portfolio"
          value={firstPar ? `₹${firstPar.totalOutstandingPrincipal.toLocaleString()}` : "₹0"}
          hint="Total active principal exposure"
          icon={CheckCircle2}
          tone="emerald"
        />
      </div>

      {/* PAR Summaries by Currency */}
      <div className="mt-6">
        <Card className="overflow-hidden p-5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Portfolio at Risk (PAR) Summary by Currency
          </h2>
          <p className="text-xs text-slate-500 mb-4 mt-1">
            PAR N = Full current outstanding principal of active/defaulted loans with DPD ≥ N / Total outstanding portfolio principal.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2">Currency</th>
                  <th className="py-2 text-right">Active Facilities</th>
                  <th className="py-2 text-right">Outstanding Principal</th>
                  <th className="py-2 text-right">Overdue Principal</th>
                  <th className="py-2 text-right">PAR 1 (≥1 DPD)</th>
                  <th className="py-2 text-right">PAR 30 (≥30 DPD)</th>
                  <th className="py-2 text-right">PAR 60 (≥60 DPD)</th>
                  <th className="py-2 text-right">PAR 90+ (≥90 DPD)</th>
                </tr>
              </thead>
              <tbody>
                {report.parSummaries.length ? (
                  report.parSummaries.map((par) => (
                    <tr key={par.currency} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                      <td className="py-3"><CurrencyBadge currency={par.currency} /></td>
                      <td className="py-3 text-right font-semibold text-slate-700">{par.totalActiveLoans}</td>
                      <td className="py-3 text-right font-bold text-slate-900"><MoneyDisplay value={par.totalOutstandingPrincipal} currency={par.currency} /></td>
                      <td className="py-3 text-right font-semibold text-rose-700"><MoneyDisplay value={par.totalOverduePrincipal} currency={par.currency} /></td>
                      <td className="py-3 text-right font-bold text-amber-700">{par.par1Rate}% ({par.par1Amount})</td>
                      <td className="py-3 text-right font-bold text-amber-800">{par.par30Rate}% ({par.par30Amount})</td>
                      <td className="py-3 text-right font-bold text-rose-700">{par.par60Rate}% ({par.par60Amount})</td>
                      <td className="py-3 text-right font-extrabold text-rose-900">{par.par90Rate}% ({par.par90Amount})</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-xs text-slate-500">No active portfolio facilities found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Mutually Exclusive Aging Buckets */}
      <div className="mt-6">
        <Card className="overflow-hidden p-5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Mutually Exclusive Aging Distribution Buckets
          </h2>
          <p className="text-xs text-slate-500 mb-4 mt-1">
            Categorized strictly by oldest unpaid overdue installment DPD. Each loan appears in exactly one bucket.
          </p>

          {Object.entries(report.agingBucketsByCurrency).map(([curr, buckets]) => (
            <div key={curr} className="mb-6">
              <div className="mb-2 flex items-center gap-2">
                <CurrencyBadge currency={curr} />
                <span className="text-xs font-bold text-slate-700">Portfolio Breakdown</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                      <th className="py-2">Aging Bucket</th>
                      <th className="py-2 text-right">Loan Count</th>
                      <th className="py-2 text-right">Outstanding Principal</th>
                      <th className="py-2 text-right">% of Portfolio</th>
                    </tr>
                  </thead>
                  <tbody>
                    {buckets.map((b) => (
                      <tr key={b.bucket} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-2.5 font-semibold text-slate-800">{b.bucket}</td>
                        <td className="py-2.5 text-right font-medium text-slate-700">{b.loanCount}</td>
                        <td className="py-2.5 text-right font-bold text-slate-900"><MoneyDisplay value={b.outstandingPrincipal} currency={curr} /></td>
                        <td className="py-2.5 text-right font-extrabold text-indigo-700">{b.percentageOfPortfolio}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Card>
      </div>

      {/* Collection Performance & Vintage Cohorts */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* Collection Performance */}
        <Card className="overflow-hidden p-5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Collection Performance Rate
          </h2>
          <p className="text-xs text-slate-500 mb-3 mt-1">
            Cash Collected (POSTED repayments minus reversals) / Scheduled Amount Due in period.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2">Currency</th>
                  <th className="py-2 text-right">Contractual Scheduled Due</th>
                  <th className="py-2 text-right">Penalty Assessed</th>
                  <th className="py-2 text-right">Cash Collected</th>
                  <th className="py-2 text-right">Collection Rate</th>
                </tr>
              </thead>
              <tbody>
                {report.collectionPerformance.length ? (
                  report.collectionPerformance.map((cp) => (
                    <tr key={cp.currency} className="border-b border-slate-100">
                      <td className="py-2.5"><CurrencyBadge currency={cp.currency} /></td>
                      <td className="py-2.5 text-right font-medium text-slate-700"><MoneyDisplay value={cp.scheduledDueAmount} currency={cp.currency} /></td>
                      <td className="py-2.5 text-right font-medium text-rose-600"><MoneyDisplay value={cp.penaltyAssessedAmount} currency={cp.currency} /></td>
                      <td className="py-2.5 text-right font-bold text-emerald-700"><MoneyDisplay value={cp.cashCollectedAmount} currency={cp.currency} /></td>
                      <td className="py-2.5 text-right font-extrabold text-indigo-800">
                        {cp.collectionRatePercent !== null ? `${cp.collectionRatePercent}%` : "N/A"}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-500">No scheduled installments in current period.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Vintage / Cohort Analysis */}
        <Card className="overflow-hidden p-5">
          <h2 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-2">
            Vintage Cohort Analysis (by Disbursement Month)
          </h2>
          <p className="text-xs text-slate-500 mb-3 mt-1">
            Loans grouped by actual disbursement month (YYYY-MM).
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-2">Cohort Month</th>
                  <th className="py-2 text-right">Originated</th>
                  <th className="py-2 text-right">Disbursed Principal</th>
                  <th className="py-2 text-right">Current Principal</th>
                  <th className="py-2 text-right">PAR 30</th>
                </tr>
              </thead>
              <tbody>
                {report.vintageCohorts.length ? (
                  report.vintageCohorts.map((v) => (
                    <tr key={v.cohortMonth} className="border-b border-slate-100">
                      <td className="py-2.5 font-bold text-indigo-700">{v.cohortMonth}</td>
                      <td className="py-2.5 text-right font-medium text-slate-700">{v.loansOriginated} loans</td>
                      <td className="py-2.5 text-right font-bold text-slate-900">₹{v.originalDisbursedPrincipal.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-semibold text-slate-700">₹{v.currentOutstandingPrincipal.toLocaleString()}</td>
                      <td className="py-2.5 text-right font-bold text-rose-700">₹{v.par30Amount.toLocaleString()}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-slate-500">No disbursed loan cohorts recorded yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Operational Provisioning Exposure */}
      <Card className="mt-6 border-amber-200 bg-amber-50/40 p-5">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-amber-600" />
          <div>
            <h2 className="text-base font-bold text-amber-950">Operational Provisioning Exposure</h2>
            <p className="text-xs text-amber-800 font-medium">
              Disclosure: {report.provisioningEstimates[0]?.disclaimer || "Operational Provisioning Exposure — percentages not configured."}
            </p>
          </div>
        </div>

        {report.provisioningEstimates.map((pe) => (
          <div key={pe.currency} className="mt-4">
            <div className="mb-2 flex items-center gap-2">
              <CurrencyBadge currency={pe.currency} />
              <span className="text-xs font-bold text-slate-800">
                Risk Category Exposure Breakdown
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-amber-200 text-xs font-semibold text-amber-900">
                    <th className="py-2">Risk Band</th>
                    <th className="py-2">Description</th>
                    <th className="py-2 text-right">Outstanding Principal Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {pe.bands.map((b) => (
                    <tr key={b.band} className="border-b border-amber-100">
                      <td className="py-2 font-bold text-slate-800">{b.band}</td>
                      <td className="py-2 text-xs text-slate-600">{b.description}</td>
                      <td className="py-2 text-right font-semibold text-slate-900"><MoneyDisplay value={b.outstandingPrincipal} currency={pe.currency} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

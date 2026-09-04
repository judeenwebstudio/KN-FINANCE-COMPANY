"use client";

import { useState } from "react";
import { FileText, Download, Wallet, HandCoins, Receipt, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status-badge";

type AccountDTO = {
  id: string;
  accountNumber: string;
  accountType: string;
  currency: string;
  balance: string;
  status: string;
  createdAt: string;
};

type LoanDTO = {
  id: string;
  loanNumber: string;
  productName: string;
  currency: string;
  principalAmount: string;
  paidAmount: string;
  status: string;
  createdAt: string;
};

type TransactionDTO = {
  id: string;
  accountNumber: string;
  reference: string;
  type: string;
  amount: string;
  currency: string;
  status: string;
  createdAt: string;
};

type RepaymentDTO = {
  id: string;
  repaymentNumber: string;
  loanNumber: string;
  accountNumber: string;
  amount: string;
  principalPaid: string;
  interestPaid: string;
  paymentDate: string;
  status: string;
};

export function MemberReportsClient({
  memberName,
  memberNumber,
  accounts,
  loans,
  transactions,
  repayments,
}: {
  memberName: string;
  memberNumber: string;
  accounts: AccountDTO[];
  loans: LoanDTO[];
  transactions: TransactionDTO[];
  repayments: RepaymentDTO[];
}) {
  const [activeTab, setActiveTab] = useState<"accounts" | "loans" | "transactions" | "repayments">("accounts");

  const exportCSV = (data: Record<string, string>[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map((row) => Object.values(row).map((v) => `"${v}"`).join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [headers, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}_${memberNumber}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val: string, currency: string) => {
    const num = parseFloat(val || "0");
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: currency || "INR",
    }).format(isNaN(num) ? 0 : num);
  };

  const formatDate = (isoStr: string) => {
    return new Date(isoStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <FileText className="size-6 text-indigo-600" /> Statements & Reports
          </h1>
          <p className="text-sm text-slate-500">
            Self-service financial statements and ledger history for <strong className="text-slate-700">{memberName}</strong> (<span className="font-mono font-bold text-slate-700">{memberNumber}</span>).
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => {
            if (activeTab === "accounts") exportCSV(accounts, "accounts_statement");
            else if (activeTab === "loans") exportCSV(loans, "loans_statement");
            else if (activeTab === "transactions") exportCSV(transactions, "transaction_history");
            else if (activeTab === "repayments") exportCSV(repayments, "repayment_history");
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 shadow-xs"
        >
          <Download className="size-3.5" /> Export CSV Statement
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab("accounts")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "accounts" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Wallet className="size-3.5" /> Accounts Statement ({accounts.length})
        </button>
        <button
          onClick={() => setActiveTab("loans")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "loans" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <HandCoins className="size-3.5" /> Loans Statement ({loans.length})
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "transactions" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <ArrowLeftRight className="size-3.5" /> Transactions ({transactions.length})
        </button>
        <button
          onClick={() => setActiveTab("repayments")}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-colors ${
            activeTab === "repayments" ? "bg-indigo-50 text-indigo-700 border border-indigo-200" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Receipt className="size-3.5" /> Repayments ({repayments.length})
        </button>
      </div>

      <Card className="overflow-hidden border border-slate-200 shadow-xs">
        <div className="overflow-x-auto">
          {activeTab === "accounts" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Account Number</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Balance</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Opened Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {accounts.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{a.accountNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{a.accountType}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(a.balance, a.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge tone={a.status === "ACTIVE" ? "success" : "warning"}>{a.status}</StatusBadge></td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatDate(a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "loans" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Loan #</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">Amount Paid</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {loans.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{l.loanNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{l.productName}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(l.principalAmount, l.currency)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{formatCurrency(l.paidAmount, l.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge tone={l.status === "ACTIVE" ? "success" : "neutral"}>{l.status}</StatusBadge></td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "transactions" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Account</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {transactions.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{t.reference}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{t.accountNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{t.type}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-900">{formatCurrency(t.amount, t.currency)}</td>
                    <td className="px-4 py-3"><StatusBadge tone={t.status === "COMPLETED" ? "success" : "warning"}>{t.status}</StatusBadge></td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatDate(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "repayments" && (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Repayment #</th>
                  <th className="px-4 py-3">Loan #</th>
                  <th className="px-4 py-3">Account #</th>
                  <th className="px-4 py-3 text-right">Total Amount</th>
                  <th className="px-4 py-3 text-right">Principal</th>
                  <th className="px-4 py-3 text-right">Interest</th>
                  <th className="px-4 py-3 text-right">Payment Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {repayments.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono font-bold text-indigo-700">{r.repaymentNumber}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{r.loanNumber}</td>
                    <td className="px-4 py-3 font-mono text-slate-700">{r.accountNumber}</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">{formatCurrency(r.amount, "INR")}</td>
                    <td className="px-4 py-3 text-right text-slate-700">{formatCurrency(r.principalPaid, "INR")}</td>
                    <td className="px-4 py-3 text-right text-amber-700">{formatCurrency(r.interestPaid, "INR")}</td>
                    <td className="px-4 py-3 text-right text-slate-500">{formatDate(r.paymentDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}

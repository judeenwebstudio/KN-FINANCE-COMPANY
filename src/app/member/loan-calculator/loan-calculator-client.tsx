"use client";

import { useState } from "react";
import Link from "next/link";
import { Calculator, Info, ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type ProductDTO = {
  id: string;
  name: string;
  code: string;
  minAmount: string;
  maxAmount: string;
  interestRate: number;
  minTermMonths: number;
  maxTermMonths: number;
  currency: string;
};

export function LoanCalculatorClient({ products }: { products: ProductDTO[] }) {
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id || "");
  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];

  const defaultMin = selectedProduct ? parseFloat(selectedProduct.minAmount) : 1000;
  const defaultRate = selectedProduct ? selectedProduct.interestRate : 12;
  const defaultTerm = selectedProduct ? selectedProduct.minTermMonths : 12;

  const [amount, setAmount] = useState<number>(defaultMin || 5000);
  const [termMonths, setTermMonths] = useState<number>(defaultTerm || 12);
  const [annualRate, setAnnualRate] = useState<number>(defaultRate || 12);

  // Estimative Repayment Calculation (Equal Monthly Installment Formula)
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = Math.max(1, termMonths);

  let monthlyInstallment = 0;
  if (monthlyRate > 0) {
    monthlyInstallment =
      (amount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
  } else {
    monthlyInstallment = amount / numPayments;
  }

  const totalRepayable = monthlyInstallment * numPayments;
  const totalInterest = totalRepayable - amount;

  const currency = selectedProduct?.currency || "USD";

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(isNaN(val) ? 0 : val);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Calculator className="size-6 text-indigo-600" /> Loan Repayment Estimator
          </h1>
          <p className="text-sm text-slate-500">
            Calculate estimated monthly installments and interest totals using current credit union product terms.
          </p>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 border border-amber-200 shrink-0">
          <Info className="size-3.5 text-amber-600" /> ESTIMATE ONLY
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Calculator Inputs */}
        <Card className="p-6 bg-white border-slate-200 shadow-xs space-y-5 rounded-2xl">
          <h2 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3">
            Loan Options & Parameters
          </h2>

          {/* Product Select */}
          {products.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Select Loan Product</label>
              <select
                value={selectedProductId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedProductId(id);
                  const prod = products.find((p) => p.id === id);
                  if (prod) {
                    setAmount(parseFloat(prod.minAmount));
                    setAnnualRate(prod.interestRate);
                    setTermMonths(prod.minTermMonths);
                  }
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.code}) — {p.interestRate}% APR
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Loan Amount Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">Borrowing Amount</span>
              <span className="font-bold text-indigo-700 font-mono">{formatCurrency(amount)}</span>
            </div>
            <input
              type="range"
              min={selectedProduct ? parseFloat(selectedProduct.minAmount) : 500}
              max={selectedProduct ? parseFloat(selectedProduct.maxAmount) : 100000}
              step={500}
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>{formatCurrency(selectedProduct ? parseFloat(selectedProduct.minAmount) : 500)}</span>
              <span>{formatCurrency(selectedProduct ? parseFloat(selectedProduct.maxAmount) : 100000)}</span>
            </div>
          </div>

          {/* Term Months Slider */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-slate-700">Repayment Term</span>
              <span className="font-bold text-indigo-700 font-mono">{termMonths} Months</span>
            </div>
            <input
              type="range"
              min={selectedProduct ? selectedProduct.minTermMonths : 3}
              max={selectedProduct ? selectedProduct.maxTermMonths : 60}
              step={1}
              value={termMonths}
              onChange={(e) => setTermMonths(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>{selectedProduct ? selectedProduct.minTermMonths : 3} months</span>
              <span>{selectedProduct ? selectedProduct.maxTermMonths : 60} months</span>
            </div>
          </div>

          {/* Annual Interest Rate */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Annual Interest Rate (APR %)</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              value={annualRate}
              onChange={(e) => setAnnualRate(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </Card>

        {/* Estimated Summary */}
        <Card className="p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-[#071426] text-white shadow-lg rounded-2xl flex flex-col justify-between space-y-6 border border-slate-700">
          <div>
            <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Estimated Summary
              </span>
              <span className="text-xs text-amber-300 font-mono">{currency}</span>
            </div>

            <div className="mt-6 text-center space-y-1">
              <span className="text-xs text-slate-400 block font-medium">Estimated Monthly Installment</span>
              <div className="text-3xl font-extrabold text-white tracking-tight font-mono">
                {formatCurrency(monthlyInstallment)}
              </div>
              <span className="text-[11px] text-slate-400 block">for {termMonths} consecutive months</span>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 border-t border-slate-700/80 pt-4 text-xs">
              <div>
                <span className="text-slate-400 block">Total Principal</span>
                <span className="font-mono font-bold text-slate-200">{formatCurrency(amount)}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Total Estimated Interest</span>
                <span className="font-mono font-bold text-amber-300">{formatCurrency(totalInterest)}</span>
              </div>
              <div className="col-span-2 border-t border-slate-700/50 pt-2 flex justify-between items-center">
                <span className="text-slate-300 font-semibold">Total Repayable Amount</span>
                <span className="font-mono font-extrabold text-emerald-400 text-sm">{formatCurrency(totalRepayable)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl bg-slate-800/80 p-3 text-[11px] text-slate-300 border border-slate-700 flex items-start gap-2">
              <ShieldCheck className="size-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Calculations are estimative projections and do not constitute formal approval or guarantee. Actual terms are finalized upon underwriter review.</span>
            </div>

            <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs h-10 shadow-md">
              <Link href="/member/loans/apply">
                Apply for Loan <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

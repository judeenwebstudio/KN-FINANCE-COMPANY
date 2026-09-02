"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronRight, ArrowLeft, Calculator, ShieldCheck, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/money";
import { calculatePreviewAction, submitLoanApplicationAction } from "./actions";
import type { LoanProductDTO } from "@/lib/serializers";

type ApplyClientProps = {
  products: LoanProductDTO[];
};

type PreviewScheduleRow = {
  installmentNumber: number;
  dueDate: string;
  principalDue: string;
  interestDue: string;
  feeDue: string;
  totalDue: string;
};

type PreviewData = {
  productName: string;
  productCode: string;
  currency: string;
  principalAmount: string;
  interestRate: string;
  interestType: string;
  termMonths: number;
  repaymentFrequency: string;
  processingFee: string;
  totalInterest: string;
  totalPayable: string;
  estimatedInstallment: string;
  firstDueDate: string;
  maturityDate: string;
  schedule: PreviewScheduleRow[];
};

export function ApplyClient({ products }: ApplyClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

  const [selectedProductId, setSelectedProductId] = useState<string>(
    products[0]?.id ?? ""
  );
  const selectedProduct = products.find((p) => p.id === selectedProductId) ?? products[0];

  const [amount, setAmount] = useState<number>(
    selectedProduct ? Number(selectedProduct.minimumAmount) : 1000
  );
  const [termMonths, setTermMonths] = useState<number>(
    selectedProduct ? selectedProduct.minimumTermMonths : 12
  );

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [calculating, setCalculating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleProductSelect(prod: LoanProductDTO) {
    setSelectedProductId(prod.id);
    setAmount(Number(prod.minimumAmount));
    setTermMonths(prod.minimumTermMonths);
    setError(null);
  }

  async function handleGoToPreview() {
    if (!selectedProduct) return;
    setCalculating(true);
    setError(null);

    const formData = new FormData();
    formData.append("productId", selectedProduct.id);
    formData.append("principalAmount", amount.toString());
    formData.append("termMonths", termMonths.toString());

    const result = await calculatePreviewAction(formData);
    setCalculating(false);

    if (result.error || !result.preview) {
      setError(result.error ?? "Failed to calculate preview");
    } else {
      setPreviewData(result.preview);
      setStep(3);
    }
  }

  async function handleSubmitApplication() {
    if (!selectedProduct) return;
    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append("productId", selectedProduct.id);
    formData.append("principalAmount", amount.toString());
    formData.append("termMonths", termMonths.toString());

    const result = await submitLoanApplicationAction({}, formData);
    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else if (result.loanId) {
      router.push(`/member/loans/${result.loanId}`);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Apply for a Loan</h1>
        <p className="text-sm text-slate-500">
          Select a product, calculate your repayment plan, and submit your application.
        </p>
      </div>

      {/* Progress Wizard Header */}
      <div className="grid grid-cols-4 gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs sm:gap-4 sm:p-4">
        {[
          { num: 1, title: "Product" },
          { num: 2, title: "Amount & Term" },
          { num: 3, title: "Preview" },
          { num: 4, title: "Review & Submit" },
        ].map((s) => {
          const active = step === s.num;
          const done = step > s.num;
          return (
            <div
              key={s.num}
              className={`flex items-center gap-2 rounded-xl p-2 sm:p-2.5 transition ${
                active
                  ? "bg-indigo-50 text-indigo-700 font-semibold"
                  : done
                  ? "text-emerald-700"
                  : "text-slate-400"
              }`}
            >
              <div
                className={`grid size-7 shrink-0 place-items-center rounded-lg text-xs font-bold ${
                  active
                    ? "bg-indigo-600 text-white"
                    : done
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {done ? <CheckCircle2 className="size-4" /> : s.num}
              </div>
              <span className="hidden text-xs sm:inline">{s.title}</span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          {error}
        </div>
      )}

      {/* STEP 1: Select Loan Product */}
      {step === 1 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-slate-900">Step 1: Choose a Loan Product</h2>
          {products.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">
              No loan products are available for application right now.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {products.map((p) => {
                const selected = p.id === selectedProductId;
                return (
                  <div
                    key={p.id}
                    onClick={() => handleProductSelect(p)}
                    className={`cursor-pointer rounded-2xl border p-5 transition ${
                      selected
                        ? "border-indigo-600 bg-indigo-50/40 ring-2 ring-indigo-200"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">{p.name}</h3>
                        <span className="mt-1 inline-block rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-medium text-slate-600">
                          {p.code}
                        </span>
                      </div>
                      <span className="text-lg font-bold text-indigo-600">{p.interestRate}% APR</span>
                    </div>

                    <p className="mt-3 text-xs text-slate-500 line-clamp-2">{p.description}</p>

                    <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-600 space-y-1">
                      <div className="flex justify-between">
                        <span>Amount Limit:</span>
                        <span className="font-medium text-slate-900">
                          {formatMoney(p.minimumAmount, p.currency)} – {formatMoney(p.maximumAmount, p.currency)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Term Range:</span>
                        <span className="font-medium text-slate-900">
                          {p.minimumTermMonths} – {p.maximumTermMonths} months
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Type & Frequency:</span>
                        <span className="font-medium text-slate-900">
                          {p.interestType === "FLAT" ? "Flat" : "Declining"} ({p.repaymentFrequency.toLowerCase()})
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button
              disabled={!selectedProduct}
              onClick={() => setStep(2)}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              Continue to Amount & Term <ChevronRight className="ml-2 size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2: Enter Amount & Term */}
      {step === 2 && selectedProduct && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 2: Enter Loan Amount & Term</h2>
              <p className="text-xs text-slate-500">Selected Product: {selectedProduct.name}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-1 size-4" /> Change Product
            </Button>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm font-semibold text-slate-700">
                <label>Loan Amount ({selectedProduct.currency})</label>
                <span className="text-indigo-600 font-bold">{formatMoney(amount, selectedProduct.currency)}</span>
              </div>
              <input
                type="number"
                min={Number(selectedProduct.minimumAmount)}
                max={Number(selectedProduct.maximumAmount)}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-base font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">
                Min: {formatMoney(selectedProduct.minimumAmount, selectedProduct.currency)} | Max:{" "}
                {formatMoney(selectedProduct.maximumAmount, selectedProduct.currency)}
              </p>
            </div>

            <div>
              <div className="flex justify-between text-sm font-semibold text-slate-700">
                <label>Repayment Term (Months)</label>
                <span className="text-indigo-600 font-bold">{termMonths} Months</span>
              </div>
              <input
                type="number"
                min={selectedProduct.minimumTermMonths}
                max={selectedProduct.maximumTermMonths}
                value={termMonths}
                onChange={(e) => setTermMonths(Number(e.target.value))}
                className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50/60 px-4 text-base font-semibold text-slate-900 focus:border-indigo-500 focus:bg-white focus:outline-none"
              />
              <p className="mt-1 text-xs text-slate-400">
                Min: {selectedProduct.minimumTermMonths} mo | Max: {selectedProduct.maximumTermMonths} mo
              </p>
            </div>
          </div>

          <div className="flex justify-between pt-4 border-t border-slate-100">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ArrowLeft className="mr-2 size-4" /> Back
            </Button>
            <Button
              onClick={handleGoToPreview}
              disabled={calculating}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {calculating ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" /> Calculating…
                </>
              ) : (
                <>
                  <Calculator className="mr-2 size-4" /> Preview Loan Breakdown
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Preview Calculation */}
      {step === 3 && previewData && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Step 3: Loan Calculation Preview</h2>
                <p className="text-xs text-slate-500">Review estimated payments and repayment schedule</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-1 size-4" /> Adjust Amount/Term
              </Button>
            </div>

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="block text-xs text-slate-500">Principal</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatMoney(previewData.principalAmount, previewData.currency)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="block text-xs text-slate-500">Processing Fee</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatMoney(previewData.processingFee, previewData.currency)}
                </span>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                <span className="block text-xs text-slate-500">Total Interest</span>
                <span className="text-lg font-bold text-slate-900">
                  {formatMoney(previewData.totalInterest, previewData.currency)}
                </span>
              </div>
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                <span className="block text-xs font-semibold text-indigo-700">Total Payable</span>
                <span className="text-lg font-bold text-indigo-900">
                  {formatMoney(previewData.totalPayable, previewData.currency)}
                </span>
              </div>
            </div>

            {/* Repayment Schedule Table Preview */}
            <div>
              <h3 className="mb-3 font-bold text-slate-900">Estimated Repayment Schedule</h3>
              <div className="max-h-60 overflow-y-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-100 font-semibold text-slate-600">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Due Date</th>
                      <th className="px-3 py-2">Principal</th>
                      <th className="px-3 py-2">Interest</th>
                      <th className="px-3 py-2">Fee</th>
                      <th className="px-3 py-2 text-right">Total Due</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {previewData.schedule.map((row: PreviewScheduleRow) => (
                      <tr key={row.installmentNumber}>
                        <td className="px-3 py-2 font-medium">{row.installmentNumber}</td>
                        <td className="px-3 py-2">{new Date(row.dueDate).toLocaleDateString()}</td>
                        <td className="px-3 py-2">{formatMoney(row.principalDue, previewData.currency)}</td>
                        <td className="px-3 py-2">{formatMoney(row.interestDue, previewData.currency)}</td>
                        <td className="px-3 py-2">{formatMoney(row.feeDue, previewData.currency)}</td>
                        <td className="px-3 py-2 text-right font-bold text-slate-900">
                          {formatMoney(row.totalDue, previewData.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-between pt-4 border-t border-slate-100">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 size-4" /> Back
              </Button>
              <Button
                onClick={() => setStep(4)}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                Proceed to Final Review <ChevronRight className="ml-2 size-4" />
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Review and Submit */}
      {step === 4 && previewData && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Step 4: Review & Submit Application</h2>
              <p className="text-xs text-slate-500">
                Please confirm details before submitting your application for admin approval.
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 text-xs text-amber-800 space-y-1">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="size-4 text-amber-600" /> Terms & Application Notice
            </div>
            <p>
              By submitting this application, your loan request will be submitted with status{" "}
              <strong>PENDING</strong> for review by an authorized administrator. No repayment schedule will be
              activated until disbursement.
            </p>
          </div>

          <div className="divide-y divide-slate-100 text-sm space-y-3">
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Loan Product:</span>
              <span className="font-semibold text-slate-900">{previewData.productName} ({previewData.productCode})</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Requested Principal:</span>
              <span className="font-semibold text-slate-900">{formatMoney(previewData.principalAmount, previewData.currency)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Interest Rate & Type:</span>
              <span className="font-semibold text-slate-900">{previewData.interestRate}% APR ({previewData.interestType})</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Repayment Term:</span>
              <span className="font-semibold text-slate-900">{previewData.termMonths} Months ({previewData.repaymentFrequency.toLowerCase()})</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Processing Fee:</span>
              <span className="font-semibold text-slate-900">{formatMoney(previewData.processingFee, previewData.currency)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-slate-500">Estimated Total Payable:</span>
              <span className="font-bold text-indigo-700">{formatMoney(previewData.totalPayable, previewData.currency)}</span>
            </div>
          </div>

          <div className="flex justify-between pt-6 border-t border-slate-100">
            <Button variant="outline" onClick={() => setStep(3)} disabled={submitting}>
              <ArrowLeft className="mr-2 size-4" /> Back to Preview
            </Button>
            <Button
              onClick={handleSubmitApplication}
              disabled={submitting}
              className="bg-emerald-600 hover:bg-emerald-700 shadow-sm"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="mr-2 size-4 animate-spin" /> Submitting Application…
                </>
              ) : (
                "Submit Loan Application"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

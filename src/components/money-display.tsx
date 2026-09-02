import { formatMoney } from "@/lib/money";
export function MoneyDisplay({ value, currency, className }: { value: string | number; currency: string; className?: string }) { return <span className={className}>{formatMoney(value, currency)}</span>; }
export function CurrencyBadge({ currency }: { currency: string }) { return <span className="inline-flex rounded-md border border-indigo-100 bg-indigo-50 px-2 py-1 text-[11px] font-semibold tracking-wide text-indigo-700">{currency}</span>; }

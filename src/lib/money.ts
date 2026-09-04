const currencies = ["INR"] as const;
export type SupportedCurrency = (typeof currencies)[number];

export function formatMoney(value: string | number, _currency?: string) {
  const amount = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(amount)) return "₹0.00";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

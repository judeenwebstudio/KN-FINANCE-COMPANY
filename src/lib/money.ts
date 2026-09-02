const currencies = ["USD", "EUR", "INR"] as const;
export type SupportedCurrency = (typeof currencies)[number];

export function formatMoney(value: string | number, currency: string) {
  const validCurrency = currencies.includes(currency as SupportedCurrency) ? currency : "USD";
  return new Intl.NumberFormat("en-US", { style: "currency", currency: validCurrency, minimumFractionDigits: 2 }).format(Number(value));
}

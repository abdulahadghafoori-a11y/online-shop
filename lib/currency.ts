/** Cookie set when the user picks a display currency in the dashboard. */
export const APP_CURRENCY_COOKIE_NAME = "app_currency";

export const APP_CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar" },
  { code: "AFN", label: "Afghan Afghani" },
] as const;

export type AppCurrencyCode = (typeof APP_CURRENCY_OPTIONS)[number]["code"];

export const DEFAULT_APP_CURRENCY: AppCurrencyCode = "USD";

const ALLOWED = new Set<string>(APP_CURRENCY_OPTIONS.map((o) => o.code));

export function normalizeAppCurrency(
  raw: string | undefined | null
): AppCurrencyCode {
  const c = raw?.trim().toUpperCase() ?? "";
  if (c && ALLOWED.has(c)) return c as AppCurrencyCode;
  return DEFAULT_APP_CURRENCY;
}

export function formatAppMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: normalizeAppCurrency(currencyCode),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

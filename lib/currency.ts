/** Cookie set when the user picks a display currency in the dashboard. */
export const APP_CURRENCY_COOKIE_NAME = "app_currency";

/** User-chosen FX snapshot (live fetch or manual override). */
export const APP_FX_SNAPSHOT_COOKIE_NAME = "app_fx_snapshot";

export const APP_CURRENCY_OPTIONS = [
  { code: "USD", label: "US Dollar" },
  { code: "AFN", label: "Afghan Afghani" },
  { code: "CNY", label: "Chinese yuan (CNY)" },
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

/** Short symbol for labels next to money fields (not full Intl formatting). */
export function getCurrencySymbol(code: AppCurrencyCode): string {
  switch (code) {
    case "USD":
      return "$";
    case "AFN":
      return "؋";
    case "CNY":
      return "¥";
    default:
      return "$";
  }
}

export function formatAppMoney(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: normalizeAppCurrency(currencyCode),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

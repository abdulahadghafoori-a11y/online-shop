import type { AppCurrencyCode } from "@/lib/currency";
import type { FxRates } from "@/lib/exchangeRates";

/**
 * Book / storage currency for **all** persisted money (Postgres numeric columns).
 * Set with `AMOUNT_BASE_CURRENCY`. UI may show USD / AFN / CNY; inputs are converted
 * to this currency before insert/update. Nothing is stored “in CNY” etc.
 */
export type AmountBaseCode = "USD" | "AFN";

export function getAmountBaseCurrency(): AmountBaseCode {
  const v = process.env.AMOUNT_BASE_CURRENCY?.trim().toUpperCase();
  return v === "AFN" ? "AFN" : "USD";
}

function assertFx(fx: FxRates) {
  if (
    !Number.isFinite(fx.afnPerUsd) ||
    !Number.isFinite(fx.cnyPerUsd) ||
    fx.afnPerUsd <= 0 ||
    fx.cnyPerUsd <= 0
  ) {
    throw new Error("Invalid FX rates (need AFN/USD and CNY/USD)");
  }
}

/**
 * Convert an amount from the user's display currency into DB base currency.
 * @param fx – AFN and CNY per 1 USD (mid quotes).
 */
export function displayAmountToBase(
  amount: number,
  display: AppCurrencyCode,
  base: AmountBaseCode,
  fx: FxRates
): number {
  if (!Number.isFinite(amount)) return 0;
  assertFx(fx);
  const { afnPerUsd, cnyPerUsd } = fx;

  if (base === "USD") {
    if (display === "USD") return amount;
    if (display === "AFN") return amount / afnPerUsd;
    if (display === "CNY") return amount / cnyPerUsd;
  } else {
    if (display === "AFN") return amount;
    if (display === "USD") return amount * afnPerUsd;
    if (display === "CNY") return (amount * afnPerUsd) / cnyPerUsd;
  }
  return amount;
}

export function baseAmountToDisplay(
  amount: number,
  display: AppCurrencyCode,
  base: AmountBaseCode,
  fx: FxRates
): number {
  if (!Number.isFinite(amount)) return 0;
  assertFx(fx);
  const { afnPerUsd, cnyPerUsd } = fx;

  if (base === "USD") {
    if (display === "USD") return amount;
    if (display === "AFN") return amount * afnPerUsd;
    if (display === "CNY") return amount * cnyPerUsd;
  } else {
    if (display === "AFN") return amount;
    if (display === "USD") return amount / afnPerUsd;
    if (display === "CNY") return (amount / afnPerUsd) * cnyPerUsd;
  }
  return amount;
}

export function convertBetweenDisplay(
  amount: number,
  from: AppCurrencyCode,
  to: AppCurrencyCode,
  base: AmountBaseCode,
  fx: FxRates
): number {
  if (from === to) return amount;
  const inBase = displayAmountToBase(amount, from, base, fx);
  return baseAmountToDisplay(inBase, to, base, fx);
}

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Unit costs stored up to 6 decimal places (WAC / PO lines). */
export function roundMoney6(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}

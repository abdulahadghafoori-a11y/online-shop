import type { AppCurrencyCode } from "@/lib/currency";

/** ISO storage currency for all money columns (products, orders, expenses, …). */
export type AmountBaseCode = "USD" | "AFN";

export function getAmountBaseCurrency(): AmountBaseCode {
  const v = process.env.AMOUNT_BASE_CURRENCY?.trim().toUpperCase();
  return v === "AFN" ? "AFN" : "USD";
}

/**
 * @param afnPerUsd – AFN units for 1 USD (e.g. 70 means 1 USD = 70 AFN).
 */
export function displayAmountToBase(
  amount: number,
  display: AppCurrencyCode,
  base: AmountBaseCode,
  afnPerUsd: number
): number {
  if (!Number.isFinite(amount)) return 0;
  if (afnPerUsd <= 0 || !Number.isFinite(afnPerUsd)) {
    throw new Error("Invalid USD/AFN rate");
  }
  if (base === "USD" && display === "USD") return amount;
  if (base === "USD" && display === "AFN") return amount / afnPerUsd;
  if (base === "AFN" && display === "AFN") return amount;
  if (base === "AFN" && display === "USD") return amount * afnPerUsd;
  return amount;
}

export function baseAmountToDisplay(
  amount: number,
  display: AppCurrencyCode,
  base: AmountBaseCode,
  afnPerUsd: number
): number {
  if (!Number.isFinite(amount)) return 0;
  if (afnPerUsd <= 0 || !Number.isFinite(afnPerUsd)) {
    throw new Error("Invalid USD/AFN rate");
  }
  if (base === "USD" && display === "USD") return amount;
  if (base === "USD" && display === "AFN") return amount * afnPerUsd;
  if (base === "AFN" && display === "AFN") return amount;
  if (base === "AFN" && display === "USD") return amount / afnPerUsd;
  return amount;
}

export function convertBetweenDisplay(
  amount: number,
  from: AppCurrencyCode,
  to: AppCurrencyCode,
  base: AmountBaseCode,
  afnPerUsd: number
): number {
  if (from === to) return amount;
  const inBase = displayAmountToBase(amount, from, base, afnPerUsd);
  return baseAmountToDisplay(inBase, to, base, afnPerUsd);
}

export function roundMoney2(n: number): number {
  return Math.round(n * 100) / 100;
}

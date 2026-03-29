import { getAppCurrency } from "@/lib/appCurrencyServer";
import {
  displayAmountToBase,
  getAmountBaseCurrency,
  roundMoney2,
} from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { fxRatesFromSnapshot } from "@/lib/exchangeRates";

/** Interpret a form field as the user’s current display currency and return base DB units. */
export async function displayInputToBaseAmount(
  raw: string
): Promise<{ ok: true; value: number } | { ok: false; error: string }> {
  const n = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "Invalid amount" };
  }
  const [display, snapshot] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
  ]);
  const base = getAmountBaseCurrency();
  const fx = fxRatesFromSnapshot(snapshot);
  const value = roundMoney2(displayAmountToBase(n, display, base, fx));
  return { ok: true, value };
}

/** Empty / whitespace → 0 in base currency. */
export async function optionalDisplayMoneyToBase(
  raw: string
): Promise<{ ok: true; value: number } | { ok: false; error: string }> {
  const t = raw.trim();
  if (!t.length) return { ok: true, value: 0 };
  return displayInputToBaseAmount(t);
}

/**
 * Convert a numeric amount from the user’s current **display** currency (cookie)
 * into **book** currency (`AMOUNT_BASE_CURRENCY`). All DB money columns are stored
 * in book currency only; display currencies are for UI / cross-check.
 */
export async function userDisplayAmountToBase(amount: number): Promise<number> {
  if (!Number.isFinite(amount) || amount < 0) return 0;
  const [display, snapshot] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
  ]);
  const base = getAmountBaseCurrency();
  const fx = fxRatesFromSnapshot(snapshot);
  return roundMoney2(displayAmountToBase(amount, display, base, fx));
}

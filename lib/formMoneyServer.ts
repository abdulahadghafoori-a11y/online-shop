import { getAppCurrency } from "@/lib/appCurrencyServer";
import {
  displayAmountToBase,
  getAmountBaseCurrency,
  roundMoney2,
} from "@/lib/amountConversion";
import { getCachedUsdAfnRate } from "@/lib/exchangeRates";

/** Interpret a form field as the user’s current display currency and return base DB units. */
export async function displayInputToBaseAmount(
  raw: string
): Promise<{ ok: true; value: number } | { ok: false; error: string }> {
  const n = parseFloat(raw.replace(/,/g, ""));
  if (!Number.isFinite(n) || n < 0) {
    return { ok: false, error: "Invalid amount" };
  }
  const [display, fx] = await Promise.all([
    getAppCurrency(),
    getCachedUsdAfnRate(),
  ]);
  const base = getAmountBaseCurrency();
  const value = roundMoney2(
    displayAmountToBase(n, display, base, fx.afnPerUsd)
  );
  return { ok: true, value };
}

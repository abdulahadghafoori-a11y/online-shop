import { formatAppMoney, type AppCurrencyCode } from "@/lib/currency";
import {
  type AmountBaseCode,
  baseAmountToDisplay,
  roundMoney2,
} from "@/lib/amountConversion";
import { fxRatesFromSnapshot, type FxSnapshot } from "@/lib/exchangeRates";

/** Format a DB (base-currency) amount in the chosen display currency. */
export function formatDbMoney(
  amountInBase: number,
  display: AppCurrencyCode,
  base: AmountBaseCode,
  snapshot: FxSnapshot
): string {
  const fx = fxRatesFromSnapshot(snapshot);
  const displayAmt = roundMoney2(
    baseAmountToDisplay(amountInBase, display, base, fx)
  );
  return formatAppMoney(displayAmt, display);
}

import { formatAppMoney, type AppCurrencyCode } from "@/lib/currency";
import {
  type AmountBaseCode,
  baseAmountToDisplay,
  roundMoney2,
} from "@/lib/amountConversion";

/** Format a DB (base-currency) amount in the chosen display currency. */
export function formatDbMoney(
  amountInBase: number,
  display: AppCurrencyCode,
  base: AmountBaseCode,
  afnPerUsd: number
): string {
  const displayAmt = roundMoney2(
    baseAmountToDisplay(amountInBase, display, base, afnPerUsd)
  );
  return formatAppMoney(displayAmt, display);
}

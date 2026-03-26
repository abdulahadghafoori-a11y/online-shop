import { cookies } from "next/headers";
import {
  APP_CURRENCY_COOKIE_NAME,
  normalizeAppCurrency,
  type AppCurrencyCode,
} from "@/lib/currency";

export async function getAppCurrency(): Promise<AppCurrencyCode> {
  const store = await cookies();
  return normalizeAppCurrency(store.get(APP_CURRENCY_COOKIE_NAME)?.value);
}

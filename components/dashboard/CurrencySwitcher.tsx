"use client";

import { Banknote } from "lucide-react";
import { Label } from "@/components/ui/label";
import { APP_CURRENCY_OPTIONS } from "@/lib/currency";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";

export function CurrencySwitcher() {
  const { currency, setCurrency, pending, fx, amountBaseCurrency } =
    useAppCurrency();

  return (
    <div className="border-border space-y-2 border-t px-3 py-3">
      <Label
        htmlFor="app-currency"
        className="text-muted-foreground flex items-center gap-2 text-xs font-medium"
      >
        <Banknote className="size-3.5 shrink-0" aria-hidden />
        Display currency
      </Label>
      <select
        id="app-currency"
        value={currency}
        disabled={pending}
        onChange={(e) => setCurrency(e.target.value)}
        className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 w-full rounded-lg border px-2 text-xs outline-none focus-visible:ring-[3px] dark:bg-input/30"
      >
        {APP_CURRENCY_OPTIONS.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code} — {o.label}
          </option>
        ))}
      </select>
      <p className="text-muted-foreground text-[0.65rem] leading-snug">
        DB: {amountBaseCurrency}. 1 USD = {fx.afnPerUsd.toFixed(2)} AFN
        {fx.rateDate ? ` (${fx.rateDate})` : ""}
        {fx.source === "fallback" ? " · fallback rate" : ""}
      </p>
    </div>
  );
}

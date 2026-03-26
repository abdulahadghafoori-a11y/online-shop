"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";
import { useRouter } from "next/navigation";
import {
  type AppCurrencyCode,
  formatAppMoney,
  normalizeAppCurrency,
} from "@/lib/currency";
import {
  type AmountBaseCode,
  baseAmountToDisplay,
  convertBetweenDisplay,
  displayAmountToBase,
  roundMoney2,
} from "@/lib/amountConversion";
import type { FxSnapshot } from "@/lib/exchangeRates";
import { setAppCurrencyAction } from "@/app/dashboard/currency-actions";

type CurrencyContextValue = {
  currency: AppCurrencyCode;
  amountBaseCurrency: AmountBaseCode;
  fx: FxSnapshot;
  formatMoney: (amountInBase: number) => string;
  displayToBase: (amountInDisplay: number) => number;
  baseToDisplay: (amountInBase: number) => number;
  convertDisplay: (
    amount: number,
    from: AppCurrencyCode,
    to: AppCurrencyCode
  ) => number;
  setCurrency: (code: AppCurrencyCode | string) => void;
  pending: boolean;
};

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({
  initialCurrency,
  amountBaseCurrency,
  fx: initialFx,
  children,
}: {
  initialCurrency: AppCurrencyCode;
  amountBaseCurrency: AmountBaseCode;
  fx: FxSnapshot;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currency, setCurrencyState] = useState<AppCurrencyCode>(() =>
    normalizeAppCurrency(initialCurrency)
  );
  const [fx, setFx] = useState<FxSnapshot>(initialFx);

  useEffect(() => {
    setCurrencyState(normalizeAppCurrency(initialCurrency));
  }, [initialCurrency]);

  useEffect(() => {
    setFx(initialFx);
  }, [initialFx]);

  const setCurrency = useCallback(
    (code: AppCurrencyCode | string) => {
      const next = normalizeAppCurrency(code);
      startTransition(async () => {
        await setAppCurrencyAction(next);
        setCurrencyState(next);
        router.refresh();
      });
    },
    [router]
  );

  const displayToBase = useCallback(
    (amountInDisplay: number) =>
      roundMoney2(
        displayAmountToBase(
          amountInDisplay,
          currency,
          amountBaseCurrency,
          fx.afnPerUsd
        )
      ),
    [currency, amountBaseCurrency, fx.afnPerUsd]
  );

  const baseToDisplay = useCallback(
    (amountInBase: number) =>
      roundMoney2(
        baseAmountToDisplay(
          amountInBase,
          currency,
          amountBaseCurrency,
          fx.afnPerUsd
        )
      ),
    [currency, amountBaseCurrency, fx.afnPerUsd]
  );

  const convertDisplay = useCallback(
    (amount: number, from: AppCurrencyCode, to: AppCurrencyCode) =>
      roundMoney2(
        convertBetweenDisplay(
          amount,
          from,
          to,
          amountBaseCurrency,
          fx.afnPerUsd
        )
      ),
    [amountBaseCurrency, fx.afnPerUsd]
  );

  const formatMoney = useCallback(
    (amountInBase: number) => {
      const displayAmt = roundMoney2(
        baseAmountToDisplay(
          amountInBase,
          currency,
          amountBaseCurrency,
          fx.afnPerUsd
        )
      );
      return formatAppMoney(displayAmt, currency);
    },
    [currency, amountBaseCurrency, fx.afnPerUsd]
  );

  const value = useMemo(
    () => ({
      currency,
      amountBaseCurrency,
      fx,
      formatMoney,
      displayToBase,
      baseToDisplay,
      convertDisplay,
      setCurrency,
      pending,
    }),
    [
      currency,
      amountBaseCurrency,
      fx,
      formatMoney,
      displayToBase,
      baseToDisplay,
      convertDisplay,
      setCurrency,
      pending,
    ]
  );

  return (
    <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
  );
}

export function useAppCurrency() {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error("useAppCurrency must be used within CurrencyProvider");
  }
  return ctx;
}

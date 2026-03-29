"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Banknote, RefreshCw } from "lucide-react";
import {
  refreshFxRatesAction,
  setManualFxRatesAction,
  type FxActionResult,
} from "@/app/dashboard/fx-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { APP_CURRENCY_OPTIONS } from "@/lib/currency";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";
import {
  FX_LIVE_API,
  afnPerCnyFromRates,
  fxRatesFromSnapshot,
} from "@/lib/exchangeRates";

const manualInitial: FxActionResult | undefined = undefined;

function readImpliedCnyPerUsd(form: HTMLFormElement): number | null {
  const a = parseFloat(
    (form.querySelector('[name="afn_per_usd"]') as HTMLInputElement)?.value ??
      ""
  );
  const b = parseFloat(
    (form.querySelector('[name="afn_per_cny"]') as HTMLInputElement)?.value ??
      ""
  );
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return a / b;
}

export function CurrencySwitcher() {
  const router = useRouter();
  const { currency, setCurrency, pending, fx, amountBaseCurrency } =
    useAppCurrency();
  const [refreshPending, startRefresh] = useTransition();
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [impliedCnyPerUsd, setImpliedCnyPerUsd] = useState<number | null>(null);
  const [manualState, manualAction, manualPending] = useActionState(
    setManualFxRatesAction,
    manualInitial
  );

  const blocking = fx.source === "pending";
  const afnPerCnyLine =
    fx.cnyPerUsd > 0
      ? afnPerCnyFromRates(fxRatesFromSnapshot(fx)).toFixed(4)
      : "—";

  useEffect(() => {
    if (fx.source === "pending") setDialogOpen(true);
  }, [fx.source]);

  useEffect(() => {
    if (manualState?.ok) {
      setDialogOpen(false);
      setRefreshError(null);
      router.refresh();
    }
  }, [manualState, router]);

  useEffect(() => {
    if (refreshError) setDialogOpen(true);
  }, [refreshError]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (
      fx.cnyPerUsd > 0 &&
      Number.isFinite(fx.afnPerUsd) &&
      Number.isFinite(fx.cnyPerUsd)
    ) {
      setImpliedCnyPerUsd(fx.afnPerUsd / fx.cnyPerUsd);
    } else {
      setImpliedCnyPerUsd(null);
    }
  }, [dialogOpen, fx.afnPerUsd, fx.cnyPerUsd]);

  useEffect(() => {
    if (refreshError) toast.error(refreshError);
  }, [refreshError]);

  useEffect(() => {
    if (manualState?.ok === false && manualState.error) {
      toast.error(manualState.error);
    }
  }, [manualState]);

  function onDialogFormInput(e: React.FormEvent<HTMLFormElement>) {
    setImpliedCnyPerUsd(readImpliedCnyPerUsd(e.currentTarget));
  }

  function onRefresh() {
    setRefreshError(null);
    startRefresh(async () => {
      const r = await refreshFxRatesAction();
      if (r.ok) {
        setDialogOpen(false);
        router.refresh();
      } else {
        setRefreshError(r.error);
        setDialogOpen(true);
      }
    });
  }

  const sourceLabel =
    fx.source === "live"
      ? "Live"
      : fx.source === "manual"
        ? "Manual"
        : "Pending";

  const defaultAfnPerCny =
    !blocking && fx.source !== "pending" && fx.cnyPerUsd > 0
      ? String(afnPerCnyFromRates(fxRatesFromSnapshot(fx)))
      : undefined;

  return (
    <>
      <Dialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!next && blocking) return;
          setDialogOpen(next);
        }}
      >
        <DialogContent
          showClose={!blocking}
          onPointerDownOutside={(e) => {
            if (blocking) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (blocking) e.preventDefault();
          }}
          className="sm:max-w-md"
        >
          <DialogHeader>
            <DialogTitle>
              {blocking ? "Enter exchange rates" : "Exchange rates"}
            </DialogTitle>
            <DialogDescription>
              Enter AFN per 1 USD and AFN per 1 CNY. CNY per 1 USD is computed as
              (AFN/USD) ÷ (AFN/CNY).
            </DialogDescription>
          </DialogHeader>

          <div className="text-muted-foreground -mt-1 space-y-2 text-sm">
            <p>
              <span className="font-medium text-foreground">Live fetch: </span>
              <a
                href={FX_LIVE_API.documentationUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary font-medium underline underline-offset-2"
              >
                {FX_LIVE_API.provider}
              </a>{" "}
              —{" "}
              <code className="bg-muted rounded px-1 py-0.5 text-[0.65rem]">
                {FX_LIVE_API.requestPattern}
              </code>
            </p>
          </div>

          <form
            action={manualAction}
            className="grid gap-4"
            onInput={onDialogFormInput}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="dialog-fx-afn-usd">AFN per 1 USD</Label>
                <Input
                  id="dialog-fx-afn-usd"
                  name="afn_per_usd"
                  type="number"
                  step="0.0001"
                  min={0}
                  required
                  placeholder="e.g. 70"
                  className="tabular-nums"
                  defaultValue={
                    !blocking && fx.source !== "pending"
                      ? String(fx.afnPerUsd)
                      : undefined
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dialog-fx-afn-cny">AFN per 1 CNY</Label>
                <Input
                  id="dialog-fx-afn-cny"
                  name="afn_per_cny"
                  type="number"
                  step="0.0001"
                  min={0}
                  required
                  placeholder="e.g. 9.67"
                  className="tabular-nums"
                  defaultValue={defaultAfnPerCny}
                />
              </div>
            </div>

            {impliedCnyPerUsd != null && Number.isFinite(impliedCnyPerUsd) ? (
              <p className="text-muted-foreground text-xs tabular-nums">
                Implied: <span className="font-medium">1 USD</span> ≈{" "}
                {impliedCnyPerUsd.toFixed(4)} CNY
              </p>
            ) : null}

            <DialogFooter className="flex-col gap-2 sm:flex-col">
              <Button type="submit" disabled={manualPending} className="w-full">
                {manualPending ? "Saving…" : "Save rates"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={refreshPending}
                onClick={() => onRefresh()}
              >
                <RefreshCw
                  className={`mr-2 size-4 ${refreshPending ? "animate-spin" : ""}`}
                />
                {refreshPending ? "Fetching…" : "Try live rates instead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <div className="border-border space-y-3 border-t px-3 py-3">
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

        <div className="space-y-1.5">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 w-full gap-1.5 text-xs"
              disabled={refreshPending}
              onClick={onRefresh}
            >
              <RefreshCw
                className={`size-3.5 shrink-0 ${refreshPending ? "animate-spin" : ""}`}
              />
              {refreshPending ? "Fetching…" : "Update FX rates"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 w-full text-xs text-muted-foreground"
              onClick={() => {
                setRefreshError(null);
                setDialogOpen(true);
              }}
            >
              Enter or edit rates…
            </Button>
          </div>
          <p className="text-muted-foreground text-[0.65rem] leading-snug">
            Database money is always{" "}
            <span className="font-medium">{amountBaseCurrency}</span>; this
            switch is display / cross-check only.{" "}
            <span className="font-medium">{sourceLabel}</span>
            {fx.rateDate ? ` · ${fx.rateDate}` : ""}
          </p>
          <p className="text-muted-foreground text-[0.65rem] leading-snug tabular-nums">
            1 USD = {fx.afnPerUsd.toFixed(4)} AFN · 1 USD ={" "}
            {fx.cnyPerUsd.toFixed(4)} CNY · 1 CNY = {afnPerCnyLine} AFN
          </p>
          <p className="text-muted-foreground text-[0.65rem] leading-snug">
            Live:{" "}
            <a
              href={FX_LIVE_API.documentationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {FX_LIVE_API.provider}
            </a>
          </p>
        </div>
      </div>
    </>
  );
}

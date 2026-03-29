import { unstable_cache } from "next/cache";

/**
 * Shown in the dashboard (no secrets). Live requests are server-only.
 * @see https://www.exchangerate-api.com/docs
 */
export const FX_LIVE_API = {
  provider: "ExchangeRate-API.com",
  documentationUrl: "https://www.exchangerate-api.com/docs",
  /** v6 pattern; replace &lt;API_KEY&gt; with EXCHANGERATE_API_KEY (server env). */
  requestPattern:
    "GET https://v6.exchangerate-api.com/v6/<API_KEY>/latest/USD",
} as const;

export type FxSource = "live" | "manual" | "pending";

export type FxSnapshot = {
  /** AFN per 1 USD */
  afnPerUsd: number;
  /** CNY per 1 USD */
  cnyPerUsd: number;
  rateDate: string;
  source: FxSource;
};

/** Rates only (no metadata): use in pure conversion helpers. */
export type FxRates = Pick<FxSnapshot, "afnPerUsd" | "cnyPerUsd">;

export function fxRatesFromSnapshot(s: FxSnapshot): FxRates {
  return { afnPerUsd: s.afnPerUsd, cnyPerUsd: s.cnyPerUsd };
}

/** AFN per 1 CNY, derived from AFN/USD and CNY/USD quotes. */
export function afnPerCnyFromRates(fx: FxRates): number {
  if (fx.cnyPerUsd <= 0 || !Number.isFinite(fx.cnyPerUsd)) return 0;
  return fx.afnPerUsd / fx.cnyPerUsd;
}

/**
 * Temporary numbers only when the FX API fails and no rate cookie exists yet.
 * The dashboard opens a dialog so you can enter AFN/USD and AFN/CNY; nothing
 * is read from .env for this.
 */
const PLACEHOLDER_AFN_PER_USD = 70;
const PLACEHOLDER_CNY_PER_USD = 7.24;

export function snapshotWhenFetchUnavailable(): FxSnapshot {
  return {
    afnPerUsd: PLACEHOLDER_AFN_PER_USD,
    cnyPerUsd: PLACEHOLDER_CNY_PER_USD,
    rateDate: new Date().toISOString().slice(0, 10),
    source: "pending",
  };
}

function exchangerateApiLatestUrl(): string {
  const key = process.env.EXCHANGERATE_API_KEY?.trim();
  if (!key) {
    throw new Error(
      "EXCHANGERATE_API_KEY is not set. Add it to .env.local (see .env.example)."
    );
  }
  return `https://v6.exchangerate-api.com/v6/${encodeURIComponent(key)}/latest/USD`;
}

export async function fetchFxLive(): Promise<{
  afnPerUsd: number;
  cnyPerUsd: number;
  rateDate: string;
}> {
  const res = await fetch(exchangerateApiLatestUrl());
  if (!res.ok) {
    throw new Error(`FX HTTP ${res.status}`);
  }
  const j = (await res.json()) as {
    result?: string;
    "error-type"?: string;
    conversion_rates?: { AFN?: number; CNY?: number };
    time_last_update_utc?: string;
  };
  if (j.result !== "success") {
    const hint = j["error-type"] ? ` (${j["error-type"]})` : "";
    throw new Error(`ExchangeRate-API error${hint}`);
  }
  const afn = j.conversion_rates?.AFN;
  const cny = j.conversion_rates?.CNY;
  if (
    typeof afn !== "number" ||
    afn <= 0 ||
    typeof cny !== "number" ||
    cny <= 0
  ) {
    throw new Error("Invalid FX response (missing AFN or CNY)");
  }
  let rateDate = new Date().toISOString().slice(0, 10);
  if (j.time_last_update_utc) {
    const d = new Date(j.time_last_update_utc);
    if (!Number.isNaN(d.getTime())) {
      rateDate = d.toISOString().slice(0, 10);
    }
  }
  return { afnPerUsd: afn, cnyPerUsd: cny, rateDate };
}

/**
 * Bust cache when API key appears/changes (dev-friendly).
 * @see https://www.exchangerate-api.com/docs
 */
function fxCacheKeyPart(): string {
  const k = process.env.EXCHANGERATE_API_KEY?.trim() ?? "";
  return k ? `k-${k.length}:${k.slice(0, 4)}` : "no-key";
}

/**
 * Cached USD base rates (AFN + CNY per 1 USD). Revalidates daily.
 * On failure (missing key, network, bad response) returns {@link snapshotWhenFetchUnavailable}.
 */
export const getCachedFxRates = unstable_cache(
  async (): Promise<FxSnapshot> => {
    try {
      const r = await fetchFxLive();
      return { ...r, source: "live" };
    } catch {
      return snapshotWhenFetchUnavailable();
    }
  },
  ["usd-fx-exchangerate-api-v6", fxCacheKeyPart()],
  { revalidate: 86400 }
);

/** @deprecated Use getCachedFxRates — kept for older imports. */
export async function getCachedUsdAfnRate(): Promise<FxSnapshot> {
  return getCachedFxRates();
}

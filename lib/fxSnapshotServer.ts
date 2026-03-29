import { cookies } from "next/headers";
import { APP_FX_SNAPSHOT_COOKIE_NAME } from "@/lib/currency";
import { getCachedFxRates, type FxSnapshot } from "@/lib/exchangeRates";

type StoredFx = {
  afnPerUsd: number;
  cnyPerUsd: number;
  rateDate?: string;
  source?: FxSnapshot["source"];
};

function parseFxCookie(raw: string | undefined): FxSnapshot | null {
  if (!raw?.trim()) return null;
  try {
    const j = JSON.parse(raw) as StoredFx;
    if (
      typeof j.afnPerUsd !== "number" ||
      typeof j.cnyPerUsd !== "number" ||
      j.afnPerUsd <= 0 ||
      j.cnyPerUsd <= 0 ||
      !Number.isFinite(j.afnPerUsd) ||
      !Number.isFinite(j.cnyPerUsd)
    ) {
      return null;
    }
    const source: FxSnapshot["source"] =
      j.source === "manual" || j.source === "live" ? j.source : "live";
    return {
      afnPerUsd: j.afnPerUsd,
      cnyPerUsd: j.cnyPerUsd,
      rateDate:
        typeof j.rateDate === "string" && j.rateDate.length >= 10
          ? j.rateDate.slice(0, 10)
          : new Date().toISOString().slice(0, 10),
      source,
    };
  } catch {
    return null;
  }
}

/**
 * FX for server-rendered money: user cookie (live refresh or manual) if set,
 * otherwise ISR-cached rates (live API, or `pending` placeholders until manual entry).
 */
export async function getFxSnapshotForRequest(): Promise<FxSnapshot> {
  const store = await cookies();
  const fromCookie = parseFxCookie(
    store.get(APP_FX_SNAPSHOT_COOKIE_NAME)?.value
  );
  if (fromCookie) return fromCookie;
  return getCachedFxRates();
}

import { unstable_cache } from "next/cache";

export type FxSnapshot = {
  /** AFN per 1 USD */
  afnPerUsd: number;
  /** Business date from provider (YYYY-MM-DD) */
  rateDate: string;
  source: "live" | "fallback";
};

async function fetchUsdAfnLive(): Promise<{ afnPerUsd: number; rateDate: string }> {
  const res = await fetch(
    "https://api.exchangerate.host/latest?base=USD&symbols=AFN"
  );
  if (!res.ok) {
    throw new Error(`FX HTTP ${res.status}`);
  }
  const j = (await res.json()) as {
    success?: boolean;
    rates?: { AFN?: number };
    date?: string;
  };
  if (
    j.success !== true ||
    typeof j.rates?.AFN !== "number" ||
    j.rates.AFN <= 0
  ) {
    throw new Error("Invalid FX response");
  }
  const rateDate =
    typeof j.date === "string" && j.date.length >= 10
      ? j.date.slice(0, 10)
      : new Date().toISOString().slice(0, 10);
  return { afnPerUsd: j.rates.AFN, rateDate };
}

/**
 * Mid-market USD→AFN, refreshed at most once per day per deploy (ISR cache).
 * Uses exchangerate.host; on failure uses FALLBACK_AFN_PER_USD or 70.
 */
export const getCachedUsdAfnRate = unstable_cache(
  async (): Promise<FxSnapshot> => {
    try {
      const r = await fetchUsdAfnLive();
      return { ...r, source: "live" };
    } catch {
      const fb = Number(process.env.FALLBACK_AFN_PER_USD ?? "70");
      const afnPerUsd =
        Number.isFinite(fb) && fb > 0 ? fb : 70;
      return {
        afnPerUsd,
        rateDate: new Date().toISOString().slice(0, 10),
        source: "fallback",
      };
    }
  },
  ["usd-afn-daily-v2"],
  { revalidate: 86400 }
);

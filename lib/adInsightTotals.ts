import type { SupabaseClient } from "@supabase/supabase-js";

export type InsightTotals = {
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  /** Rows summed (e.g. days with data at this grain) */
  rowCount: number;
  firstDate: string | null;
  lastDate: string | null;
};

export function emptyInsightTotals(): InsightTotals {
  return {
    spend: 0,
    clicks: 0,
    impressions: 0,
    reach: 0,
    rowCount: 0,
    firstDate: null,
    lastDate: null,
  };
}

type NumericInsightRow = {
  spend?: unknown;
  clicks?: unknown;
  impressions?: unknown;
  reach?: unknown;
  extra?: Record<string, unknown> | null;
  date?: string | null;
};

function extractReach(row: NumericInsightRow): number {
  if (row.reach != null) return Number(row.reach);
  const extra = row.extra;
  if (!extra || typeof extra !== "object") return 0;
  return Number(extra.reach ?? 0);
}

export function sumInsightRows(rows: NumericInsightRow[]): InsightTotals {
  let spend = 0;
  let clicks = 0;
  let impressions = 0;
  let reach = 0;
  let first: string | null = null;
  let last: string | null = null;
  for (const r of rows) {
    spend += Number(r.spend ?? 0);
    clicks += Number(r.clicks ?? 0);
    impressions += Number(r.impressions ?? 0);
    reach += extractReach(r);
    const d = r.date ?? null;
    if (d) {
      if (!first || d < first) first = d;
      if (!last || d > last) last = d;
    }
  }
  return {
    spend,
    clicks,
    impressions,
    reach,
    rowCount: rows.length,
    firstDate: first,
    lastDate: last,
  };
}

/** Campaign totals from granular daily_ad_insights (includes extra for reach). */
export async function fetchCampaignInsightTotals(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<InsightTotals> {
  const { data, error } = await supabase
    .from("daily_ad_insights")
    .select("date, spend, clicks, impressions, extra")
    .eq("campaign_id", campaignId)
    .order("date", { ascending: true });

  if (error || !data?.length) return emptyInsightTotals();
  return sumInsightRows(data as NumericInsightRow[]);
}

export type CampaignBreakdownRow = {
  adset_id: string | null;
  ad_id: string | null;
  spend: string | number | null;
  clicks: number | string | null;
  impressions: number | string | null;
  extra?: Record<string, unknown> | null;
  date: string;
};

/** Rows with an ad set, for per–ad set / per-ad splits (CSV + API ad grain). */
export async function fetchCampaignAdsetGrainRows(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<CampaignBreakdownRow[]> {
  const { data, error } = await supabase
    .from("daily_ad_insights")
    .select("adset_id, ad_id, spend, clicks, impressions, extra, date")
    .eq("campaign_id", campaignId)
    .not("adset_id", "is", null);

  if (error || !data) return [];
  return data as CampaignBreakdownRow[];
}

/** Prefer ad-day rows; if none for this ad set, use ad-set–only rows. */
export function sliceRowsForAdset(
  all: CampaignBreakdownRow[],
  adsetId: string,
): CampaignBreakdownRow[] {
  const sub = all.filter((r) => r.adset_id === adsetId);
  const adLevel = sub.filter((r) => r.ad_id != null);
  if (adLevel.length) return adLevel;
  return sub.filter((r) => r.ad_id == null);
}

export function computeAdsetTotalsMap(
  rows: CampaignBreakdownRow[],
  adsetIds: string[],
): Map<string, InsightTotals> {
  const map = new Map<string, InsightTotals>();
  for (const id of adsetIds) {
    map.set(id, sumInsightRows(sliceRowsForAdset(rows, id)));
  }
  return map;
}

export function computeAdTotalsMap(
  rows: CampaignBreakdownRow[],
  adIds: string[],
): Map<string, InsightTotals> {
  const map = new Map<string, InsightTotals>();
  for (const id of adIds) {
    const sub = rows.filter((r) => r.ad_id === id);
    map.set(id, sumInsightRows(sub));
  }
  return map;
}

export type DailyInsightRow = {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
};

export async function fetchDailyadstatsSeries(
  supabase: SupabaseClient,
  campaignId: string,
  limit = 90,
): Promise<DailyInsightRow[]> {
  const { data, error } = await supabase
    .from("daily_ad_insights")
    .select("date, spend, clicks, impressions, extra")
    .eq("campaign_id", campaignId)
    .order("date", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const map = new Map<string, DailyInsightRow>();
  for (const r of data) {
    const d = r.date as string;
    const cur = map.get(d) ?? { date: d, spend: 0, clicks: 0, impressions: 0, reach: 0 };
    cur.spend += Number(r.spend ?? 0);
    cur.clicks += Number(r.clicks ?? 0);
    cur.impressions += Number(r.impressions ?? 0);
    cur.reach += extractReach({ extra: r.extra as Record<string, unknown> | null });
    map.set(d, cur);
  }

  return [...map.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export async function fetchAdInsightRows(
  supabase: SupabaseClient,
  adId: string,
): Promise<DailyInsightRow[]> {
  const { data, error } = await supabase
    .from("daily_ad_insights")
    .select("date, spend, clicks, impressions, extra")
    .eq("ad_id", adId)
    .order("date", { ascending: false });

  if (error || !data) return [];
  return data.map((r) => ({
    date: r.date as string,
    spend: Number(r.spend ?? 0),
    clicks: Number(r.clicks ?? 0),
    impressions: Number(r.impressions ?? 0),
    reach: extractReach({ extra: r.extra as Record<string, unknown> | null }),
  }));
}

export function ctrPercent(clicks: number, impressions: number): string {
  if (impressions <= 0) return "—";
  return `${((100 * clicks) / impressions).toFixed(2)}%`;
}

type AdsetSliceRow = {
  ad_id: string | null;
  date: string;
  spend?: unknown;
  clicks?: unknown;
  impressions?: unknown;
  extra?: Record<string, unknown> | null;
};

function preferAdLevelRows<T extends AdsetSliceRow>(rows: T[]): T[] {
  const adLevel = rows.filter((r) => r.ad_id != null);
  if (adLevel.length) return adLevel;
  return rows.filter((r) => r.ad_id == null);
}

export async function fetchAdsetInsightTotals(
  supabase: SupabaseClient,
  adsetId: string,
): Promise<InsightTotals> {
  const { data, error } = await supabase
    .from("daily_ad_insights")
    .select("ad_id, spend, clicks, impressions, extra, date")
    .eq("adset_id", adsetId);

  if (error || !data?.length) return emptyInsightTotals();
  const use = preferAdLevelRows(data as AdsetSliceRow[]);
  return sumInsightRows(use);
}

export async function fetchAdsetRollupByDay(
  supabase: SupabaseClient,
  adsetId: string,
  limit = 90,
): Promise<DailyInsightRow[]> {
  const { data, error } = await supabase
    .from("daily_ad_insights")
    .select("ad_id, date, spend, clicks, impressions, extra")
    .eq("adset_id", adsetId);

  if (error || !data?.length) return [];
  const use = preferAdLevelRows(data as AdsetSliceRow[]);
  const map = new Map<string, DailyInsightRow>();
  for (const r of use) {
    const d = r.date as string;
    const cur = map.get(d) ?? { date: d, spend: 0, clicks: 0, impressions: 0, reach: 0 };
    cur.spend += Number(r.spend ?? 0);
    cur.clicks += Number(r.clicks ?? 0);
    cur.impressions += Number(r.impressions ?? 0);
    cur.reach += extractReach(r);
    map.set(d, cur);
  }
  return [...map.values()]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
}

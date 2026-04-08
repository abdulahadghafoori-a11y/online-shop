import type { SupabaseClient } from "@supabase/supabase-js";
import type { ScalingLabel } from "@/types";
import { cn } from "@/lib/utils";
import type { CampaignBreakdownRow } from "@/lib/adInsightTotals";

/** Lookback window aligned with /api/reports/scaling */
export const SCALING_WINDOW_DAYS = 7;

/** Book / display interpretation: profit per order thresholds (same as existing API). */
export const SCALE_PROFIT_PER_ORDER_MIN = 15;

export function scalingLabel(profitPerOrder: number): ScalingLabel {
  if (profitPerOrder >= SCALE_PROFIT_PER_ORDER_MIN) return "SCALE";
  if (profitPerOrder > 0) return "WATCH";
  return "KILL";
}

const LABEL_BADGE: Record<ScalingLabel, string> = {
  SCALE:
    "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-400",
  WATCH:
    "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  KILL: "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
};

export function scalingLabelBadgeClass(label: ScalingLabel, compact = true): string {
  return cn(
    "inline-block rounded-md border font-semibold",
    compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm",
    LABEL_BADGE[label],
  );
}

export type ScalingSnapshot = {
  spend: number;
  revenue: number;
  profit: number;
  orders: number;
  roas: number;
  cpa: number;
  profitperorder: number;
  label: ScalingLabel;
  windowDays: number;
  sinceDate: string;
};

export function buildScalingSnapshot(
  spend: number,
  revenue: number,
  orders: number,
  windowDays: number,
  sinceDate: string,
  cogs = 0,
  delivery = 0,
): ScalingSnapshot {
  const profit = revenue - cogs - delivery - spend;
  const profitperorder = orders > 0 ? profit / orders : 0;
  const cpa = orders > 0 ? spend / orders : 0;
  const roas = spend > 0 ? revenue / spend : 0;
  return {
    spend,
    revenue,
    profit,
    orders,
    roas,
    cpa,
    profitperorder,
    label: scalingLabel(profitperorder),
    windowDays,
    sinceDate,
  };
}

function scalingWindow(): { since: Date; sinceDate: string; sinceIso: string } {
  const since = new Date();
  since.setDate(since.getDate() - SCALING_WINDOW_DAYS);
  const sinceDate = since.toISOString().split("T")[0]!;
  const sinceIso = since.toISOString();
  return { since, sinceDate, sinceIso };
}

type OrderItems = { saleprice: number; quantity: number; product_cost_snapshot?: number };

type OrderMetrics = { revenue: number; cogs: number };

function metricsFromOrderItems(items: OrderItems[] | null | undefined): OrderMetrics {
  if (!items?.length) return { revenue: 0, cogs: 0 };
  let revenue = 0;
  let cogs = 0;
  for (const i of items) {
    const qty = Number(i.quantity);
    revenue += Number(i.saleprice) * qty;
    cogs += Number(i.product_cost_snapshot ?? 0) * qty;
  }
  return { revenue, cogs };
}

/** Campaign: roll-up spend (dailyadstats) vs orders attributed on campaignid. */
export async function getScalingForCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<ScalingSnapshot> {
  const { sinceDate, sinceIso } = scalingWindow();

  const { data: stats } = await supabase
    .from("dailyadstats")
    .select("spend")
    .eq("campaignid", campaignId)
    .gte("date", sinceDate);

  const spend = (stats ?? []).reduce((s, rAcc) => s + Number(rAcc.spend ?? 0), 0);

  const { data: orderData } = await supabase
    .from("orders")
    .select("deliverycost, orderitems(saleprice, quantity, product_cost_snapshot)")
    .eq("campaignid", campaignId)
    .neq("status", "cancelled")
    .gte("createdat", sinceIso);

  let revenue = 0;
  let cogs = 0;
  let delivery = 0;
  let orders = 0;
  for (const o of orderData ?? []) {
    orders += 1;
    delivery += Number(o.deliverycost ?? 0);
    const m = metricsFromOrderItems(o.orderitems as OrderItems[] | null);
    revenue += m.revenue;
    cogs += m.cogs;
  }

  return buildScalingSnapshot(
    spend,
    revenue,
    orders,
    SCALING_WINDOW_DAYS,
    sinceDate,
    cogs,
    delivery,
  );
}

function sliceSpendRowsForAdset(
  rows: CampaignBreakdownRow[],
  adsetId: string,
  sinceDate: string,
): CampaignBreakdownRow[] {
  const sub = rows.filter(
    (r) => r.adset_id === adsetId && r.date >= sinceDate,
  );
  const adLevel = sub.filter((r) => r.ad_id != null);
  if (adLevel.length) return adLevel;
  return sub.filter((r) => r.ad_id == null);
}

/** Ad set: delivery spend at ad-set / ad grain vs orders where ads belong to this ad set. */
export async function getScalingForAdset(
  supabase: SupabaseClient,
  adsetId: string,
): Promise<ScalingSnapshot> {
  const { sinceDate, sinceIso } = scalingWindow();

  const { data: insightRows } = await supabase
    .from("daily_ad_insights")
    .select("adset_id, ad_id, spend, date")
    .eq("adset_id", adsetId)
    .gte("date", sinceDate);

  const slice = sliceSpendRowsForAdset(
    (insightRows ?? []) as CampaignBreakdownRow[],
    adsetId,
    sinceDate,
  );
  const spend = slice.reduce((s, r) => s + Number(r.spend ?? 0), 0);

  const { data: ads } = await supabase
    .from("ads")
    .select("id")
    .eq("adsetid", adsetId);

  const adIds = (ads ?? []).map((a) => a.id);

  let revenue = 0;
  let cogs = 0;
  let delivery = 0;
  let orders = 0;

  if (adIds.length) {
    const { data: orderData } = await supabase
      .from("orders")
      .select("deliverycost, orderitems(saleprice, quantity, product_cost_snapshot)")
      .in("adid", adIds)
      .neq("status", "cancelled")
      .gte("createdat", sinceIso);

    for (const o of orderData ?? []) {
      orders += 1;
      delivery += Number(o.deliverycost ?? 0);
      const m = metricsFromOrderItems(o.orderitems as OrderItems[] | null);
      revenue += m.revenue;
      cogs += m.cogs;
    }
  }

  const { data: setOnlyOrders } = await supabase
    .from("orders")
    .select("deliverycost, orderitems(saleprice, quantity, product_cost_snapshot)")
    .eq("adsetid", adsetId)
    .is("adid", null)
    .neq("status", "cancelled")
    .gte("createdat", sinceIso);

  for (const o of setOnlyOrders ?? []) {
    orders += 1;
    delivery += Number(o.deliverycost ?? 0);
    const m = metricsFromOrderItems(o.orderitems as OrderItems[] | null);
    revenue += m.revenue;
    cogs += m.cogs;
  }

  return buildScalingSnapshot(
    spend,
    revenue,
    orders,
    SCALING_WINDOW_DAYS,
    sinceDate,
    cogs,
    delivery,
  );
}

/** Single ad: insight spend vs orders on that adid. */
export async function getScalingForAd(
  supabase: SupabaseClient,
  adId: string,
): Promise<ScalingSnapshot> {
  const { sinceDate, sinceIso } = scalingWindow();

  const { data: insightRows } = await supabase
    .from("daily_ad_insights")
    .select("spend")
    .eq("ad_id", adId)
    .gte("date", sinceDate);

  const spend = (insightRows ?? []).reduce(
    (s, r) => s + Number(r.spend ?? 0),
    0,
  );

  const { data: orderData } = await supabase
    .from("orders")
    .select("deliverycost, orderitems(saleprice, quantity, product_cost_snapshot)")
    .eq("adid", adId)
    .neq("status", "cancelled")
    .gte("createdat", sinceIso);

  let revenue = 0;
  let cogs = 0;
  let delivery = 0;
  let orders = 0;
  for (const o of orderData ?? []) {
    orders += 1;
    delivery += Number(o.deliverycost ?? 0);
    const m = metricsFromOrderItems(o.orderitems as OrderItems[] | null);
    revenue += m.revenue;
    cogs += m.cogs;
  }

  return buildScalingSnapshot(
    spend,
    revenue,
    orders,
    SCALING_WINDOW_DAYS,
    sinceDate,
    cogs,
    delivery,
  );
}

/**
 * Batch: scaling per ad set under a campaign (for campaign detail table).
 * Spend from daily_ad_insights in window; orders via ad → adset roll-up.
 */
export async function getScalingForAdsetsUnderCampaign(
  supabase: SupabaseClient,
  campaignId: string,
  adsetIds: string[],
): Promise<Map<string, ScalingSnapshot>> {
  const out = new Map<string, ScalingSnapshot>();
  if (!adsetIds.length) return out;

  const { sinceDate, sinceIso } = scalingWindow();

  const { data: insightRows } = await supabase
    .from("daily_ad_insights")
    .select("adset_id, ad_id, spend, date")
    .eq("campaign_id", campaignId)
    .gte("date", sinceDate)
    .not("adset_id", "is", null);

  const rows = (insightRows ?? []) as CampaignBreakdownRow[];

  const { data: ads } = await supabase
    .from("ads")
    .select("id, adsetid")
    .in("adsetid", adsetIds);

  const adIdsBySet = new Map<string, string[]>();
  for (const a of ads ?? []) {
    const list = adIdsBySet.get(a.adsetid) ?? [];
    list.push(a.id);
    adIdsBySet.set(a.adsetid, list);
  }

  const allAdIds = (ads ?? []).map((a) => a.id);
  type OrderBlock = {
    adid: string | null;
    deliverycost: number;
    orderitems: OrderItems[] | null;
  };
  let orderBlocks: OrderBlock[] = [];

  if (allAdIds.length) {
    const { data: od } = await supabase
      .from("orders")
      .select("adid, deliverycost, orderitems(saleprice, quantity, product_cost_snapshot)")
      .in("adid", allAdIds)
      .neq("status", "cancelled")
      .gte("createdat", sinceIso);
    orderBlocks = (od ?? []) as OrderBlock[];
  }

  type AdMetrics = { revenue: number; cogs: number; delivery: number; orders: number };
  const metricsByAd = new Map<string, AdMetrics>();
  for (const o of orderBlocks) {
    const aid = o.adid;
    if (!aid) continue;
    const cur = metricsByAd.get(aid) ?? { revenue: 0, cogs: 0, delivery: 0, orders: 0 };
    cur.orders += 1;
    cur.delivery += Number(o.deliverycost ?? 0);
    const m = metricsFromOrderItems(o.orderitems as OrderItems[] | null);
    cur.revenue += m.revenue;
    cur.cogs += m.cogs;
    metricsByAd.set(aid, cur);
  }

  const { data: setOnlyOrders } = await supabase
    .from("orders")
    .select("adsetid, deliverycost, orderitems(saleprice, quantity, product_cost_snapshot)")
    .eq("campaignid", campaignId)
    .in("adsetid", adsetIds)
    .is("adid", null)
    .neq("status", "cancelled")
    .gte("createdat", sinceIso);

  const metricsByAdsetOnly = new Map<string, AdMetrics>();
  for (const o of setOnlyOrders ?? []) {
    const sid = o.adsetid as string;
    if (!sid) continue;
    const cur = metricsByAdsetOnly.get(sid) ?? { revenue: 0, cogs: 0, delivery: 0, orders: 0 };
    cur.orders += 1;
    cur.delivery += Number(o.deliverycost ?? 0);
    const m = metricsFromOrderItems(o.orderitems as OrderItems[] | null);
    cur.revenue += m.revenue;
    cur.cogs += m.cogs;
    metricsByAdsetOnly.set(sid, cur);
  }

  for (const adsetId of adsetIds) {
    const slice = sliceSpendRowsForAdset(rows, adsetId, sinceDate);
    const spend = slice.reduce((s, r) => s + Number(r.spend ?? 0), 0);

    let revenue = 0;
    let cogs = 0;
    let delivery = 0;
    let orders = 0;
    const aids = adIdsBySet.get(adsetId) ?? [];
    for (const aid of aids) {
      const ro = metricsByAd.get(aid);
      if (ro) {
        revenue += ro.revenue;
        cogs += ro.cogs;
        delivery += ro.delivery;
        orders += ro.orders;
      }
    }
    const setOnly = metricsByAdsetOnly.get(adsetId);
    if (setOnly) {
      revenue += setOnly.revenue;
      cogs += setOnly.cogs;
      delivery += setOnly.delivery;
      orders += setOnly.orders;
    }

    out.set(
      adsetId,
      buildScalingSnapshot(
        spend,
        revenue,
        orders,
        SCALING_WINDOW_DAYS,
        sinceDate,
        cogs,
        delivery,
      ),
    );
  }

  return out;
}

/** Batch: scaling per ad (for an ad set’s ads table). */
export async function getScalingForAds(
  supabase: SupabaseClient,
  adIds: string[],
): Promise<Map<string, ScalingSnapshot>> {
  const out = new Map<string, ScalingSnapshot>();
  if (!adIds.length) return out;

  const { sinceDate, sinceIso } = scalingWindow();

  const { data: insightRows } = await supabase
    .from("daily_ad_insights")
    .select("ad_id, spend")
    .in("ad_id", adIds)
    .gte("date", sinceDate);

  const spendByAd = new Map<string, number>();
  for (const r of insightRows ?? []) {
    const id = r.ad_id as string;
    spendByAd.set(id, (spendByAd.get(id) ?? 0) + Number(r.spend ?? 0));
  }

  const { data: orderData } = await supabase
    .from("orders")
    .select("adid, deliverycost, orderitems(saleprice, quantity, product_cost_snapshot)")
    .in("adid", adIds)
    .neq("status", "cancelled")
    .gte("createdat", sinceIso);

  const statsByAd = new Map<string, { revenue: number; cogs: number; delivery: number; orders: number }>();
  for (const o of orderData ?? []) {
    const aid = o.adid as string;
    const cur = statsByAd.get(aid) ?? { revenue: 0, cogs: 0, delivery: 0, orders: 0 };
    cur.orders += 1;
    cur.delivery += Number(o.deliverycost ?? 0);
    const m = metricsFromOrderItems(o.orderitems as OrderItems[] | null);
    cur.revenue += m.revenue;
    cur.cogs += m.cogs;
    statsByAd.set(aid, cur);
  }

  for (const id of adIds) {
    const spend = spendByAd.get(id) ?? 0;
    const ro = statsByAd.get(id) ?? { revenue: 0, cogs: 0, delivery: 0, orders: 0 };
    out.set(
      id,
      buildScalingSnapshot(
        spend,
        ro.revenue,
        ro.orders,
        SCALING_WINDOW_DAYS,
        sinceDate,
        ro.cogs,
        ro.delivery,
      ),
    );
  }

  return out;
}

import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authApi";
import { createClient } from "@/lib/supabaseServer";
import {
  SCALING_WINDOW_DAYS,
  buildScalingSnapshot,
} from "@/lib/scalingReport";
import type { ScalingRow } from "@/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - SCALING_WINDOW_DAYS);
  const sinceDate = since.toISOString().split("T")[0]!;

  const { data: stats, error } = await supabase
    .from("dailyadstats")
    .select("campaignid, spend, campaigns(name)")
    .gte("date", sinceDate);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const map = new Map<
    string,
    {
      campaignid: string;
      campaignname: string;
      spend: number;
      revenue: number;
      cogs: number;
      delivery: number;
      orders: number;
    }
  >();

  for (const row of stats ?? []) {
    const id = row.campaignid as string;
    if (!map.has(id)) {
      const raw = row.campaigns as
        | { name: string }
        | { name: string }[]
        | null;
      const c = Array.isArray(raw) ? raw[0] : raw;
      map.set(id, {
        campaignid: id,
        campaignname: c?.name ?? "Unknown",
        spend: 0,
        revenue: 0,
        cogs: 0,
        delivery: 0,
        orders: 0,
      });
    }
    const e = map.get(id)!;
    e.spend += Number(row.spend ?? 0);
  }

  const campaignIds = Array.from(map.keys());
  if (campaignIds.length > 0) {
    const { data: orderData } = await supabase
      .from("orders")
      .select("campaignid, deliverycost, orderitems(saleprice, quantity, product_cost_snapshot)")
      .in("campaignid", campaignIds)
      .neq("status", "cancelled")
      .gte("createdat", since.toISOString());

    type OI = { saleprice: number; quantity: number; product_cost_snapshot: number };
    for (const o of orderData ?? []) {
      const cid = o.campaignid as string;
      const e = map.get(cid);
      if (!e) continue;
      e.orders += 1;
      e.delivery += Number(o.deliverycost ?? 0);
      const items = o.orderitems as OI[] | null;
      for (const i of items ?? []) {
        e.revenue += Number(i.saleprice) * Number(i.quantity);
        e.cogs += Number(i.product_cost_snapshot) * Number(i.quantity);
      }
    }
  }

  const result: ScalingRow[] = Array.from(map.values()).map((c) => {
    const snap = buildScalingSnapshot(
      c.spend,
      c.revenue,
      c.orders,
      SCALING_WINDOW_DAYS,
      sinceDate,
      c.cogs,
      c.delivery,
    );
    return {
      campaignid: c.campaignid,
      campaignname: c.campaignname,
      spend: snap.spend,
      revenue: snap.revenue,
      profit: snap.profit,
      orders: snap.orders,
      roas: snap.roas,
      cpa: snap.cpa,
      profitperorder: snap.profitperorder,
      label: snap.label,
    };
  });

  return NextResponse.json({ data: result });
}

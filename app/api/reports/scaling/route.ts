import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authApi";
import { createServiceClient } from "@/lib/supabaseServer";
import type { ScalingLabel, ScalingRow } from "@/types";

function label(profitPerOrder: number): ScalingLabel {
  if (profitPerOrder >= 15) return "SCALE";
  if (profitPerOrder > 0) return "WATCH";
  return "KILL";
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceDate = since.toISOString().split("T")[0];

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
      .select("campaignid, orderitems(saleprice, quantity)")
      .in("campaignid", campaignIds)
      .neq("status", "cancelled")
      .gte("createdat", since.toISOString());

    type OI = { saleprice: number; quantity: number };
    for (const o of orderData ?? []) {
      const cid = o.campaignid as string;
      const e = map.get(cid);
      if (!e) continue;
      e.orders += 1;
      const items = o.orderitems as OI[] | null;
      e.revenue +=
        items?.reduce((s, i) => s + i.saleprice * i.quantity, 0) ?? 0;
    }
  }

  const result: ScalingRow[] = Array.from(map.values()).map((c) => {
    const profit = c.revenue - c.spend;
    const profitPerOrder = c.orders > 0 ? profit / c.orders : 0;
    const cpa = c.orders > 0 ? c.spend / c.orders : 0;
    const roas = c.spend > 0 ? c.revenue / c.spend : 0;
    return {
      campaignid: c.campaignid,
      campaignname: c.campaignname,
      spend: c.spend,
      revenue: c.revenue,
      profit,
      orders: c.orders,
      roas,
      cpa,
      profitperorder: profitPerOrder,
      label: label(profitPerOrder),
    };
  });

  return NextResponse.json({ data: result });
}

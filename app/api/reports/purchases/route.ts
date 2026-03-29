import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authApi";
import {
  mapPurchaseOrderItemToLine,
  summarizePurchaseLines,
  type RawPurchaseOrderItem,
} from "@/lib/purchaseOrderLines";
import { createServiceClient } from "@/lib/supabaseServer";
import { reportRangeUtc } from "@/lib/reportDateRange";
import type { PurchaseReportRow } from "@/types";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "2024-01-01";
  const to =
    searchParams.get("to") ?? new Date().toISOString().split("T")[0];

  const { start, endExclusive } = reportRangeUtc(from, to);
  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("purchase_orders")
    .select(
      `
      id,
      supplier_name,
      status,
      created_at,
      received_at,
      purchase_order_items (
        product_id,
        quantity,
        unit_cost,
        base_cost,
        shipping_cost_per_unit,
        packaging_cost_per_unit,
        products ( name, sku )
      )
    `,
    )
    .gte("created_at", start)
    .lt("created_at", endExclusive)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows: PurchaseReportRow[] = (data ?? []).map((po) => {
    const rawItems = (po.purchase_order_items ?? []) as RawPurchaseOrderItem[];
    const lines = rawItems.map(mapPurchaseOrderItemToLine);
    const sums = summarizePurchaseLines(lines);
    return {
      id: po.id as string,
      supplier_name: po.supplier_name as string,
      status: po.status as string,
      created_at: po.created_at as string,
      received_at: (po.received_at as string | null) ?? null,
      line_count: lines.length,
      total_qty: sums.total_qty,
      total_value: sums.total_value,
      total_extended_base: sums.total_extended_base,
      total_extended_shipping: sums.total_extended_shipping,
      total_extended_packaging: sums.total_extended_packaging,
      lines,
    };
  });

  return NextResponse.json({ data: rows });
}

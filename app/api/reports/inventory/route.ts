import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authApi";
import { createServiceClient } from "@/lib/supabaseServer";
import { reportRangeUtc } from "@/lib/reportDateRange";
import type { InventoryReportResponse } from "@/types";

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

  const [productsRes, movementsRes] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, stock_on_hand, avg_cost")
      .order("name"),
    supabase
      .from("inventory_movements")
      .select("movement_type, qty")
      .gte("created_at", start)
      .lt("created_at", endExclusive),
  ]);

  if (productsRes.error) {
    return NextResponse.json(
      { error: productsRes.error.message },
      { status: 500 },
    );
  }
  if (movementsRes.error) {
    return NextResponse.json(
      { error: movementsRes.error.message },
      { status: 500 },
    );
  }

  const snapshot = (productsRes.data ?? []).map((p) => {
    const stock = Number(p.stock_on_hand);
    const avg = Number(p.avg_cost);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      stock_on_hand: stock,
      avg_cost: avg,
      value: stock * avg,
    };
  });

  const movementTotals = { IN: 0, OUT: 0, ADJUSTMENT: 0 };
  for (const m of movementsRes.data ?? []) {
    const t = m.movement_type as keyof typeof movementTotals;
      if (t === "IN" || t === "OUT") {
        movementTotals[t] += Math.abs(Number(m.qty));
      } else if (t === "ADJUSTMENT") {
        movementTotals.ADJUSTMENT += Number(m.qty);
      }
  }

  const body: InventoryReportResponse = {
    snapshot: snapshot.sort((a, b) => b.value - a.value),
    movementTotals,
  };

  return NextResponse.json(body);
}

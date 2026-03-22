import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authApi";
import { createServiceClient } from "@/lib/supabaseServer";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const [{ count: clicks }, { count: leads }, { count: orders }] =
    await Promise.all([
      supabase.from("clicks").select("*", { count: "exact", head: true }),
      supabase.from("leads").select("*", { count: "exact", head: true }),
      supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .neq("status", "cancelled"),
    ]);

  const c = clicks ?? 0;
  const l = leads ?? 0;
  const o = orders ?? 0;

  return NextResponse.json({
    data: {
      clicks: c,
      leads: l,
      orders: o,
      clicktolead: c > 0 ? `${((l / c) * 100).toFixed(1)}%` : "0%",
      leadtoorder: l > 0 ? `${((o / l) * 100).toFixed(1)}%` : "0%",
      clicktoorder: c > 0 ? `${((o / c) * 100).toFixed(1)}%` : "0%",
    },
  });
}

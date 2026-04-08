import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authApi";
import { createClient } from "@/lib/supabaseServer";
import { parseReportDateParam, todayISO } from "@/lib/reportDateRange";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = parseReportDateParam(searchParams.get("from"), "2024-01-01");
  const to = parseReportDateParam(searchParams.get("to"), todayISO());

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("orders_profit_report", {
    datefrom: from,
    dateto: to,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

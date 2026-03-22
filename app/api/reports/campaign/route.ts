import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authApi";
import { createServiceClient } from "@/lib/supabaseServer";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") ?? "2024-01-01";
  const to =
    searchParams.get("to") ?? new Date().toISOString().split("T")[0];

  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc("campaignprofitreport", {
    datefrom: from,
    dateto: to,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ data });
}

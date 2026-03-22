import { NextRequest, NextResponse } from "next/server";
import { generateClickId } from "@/lib/clickId";
import { detectDevice } from "@/lib/deviceDetect";
import { createServiceClient } from "@/lib/supabaseServer";
import { parseUuid } from "@/lib/uuid";
import type { TrackClickPayload } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as TrackClickPayload;
    const userAgent = req.headers.get("user-agent") ?? "";
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "";

    const clickid = generateClickId();
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("clicks")
      .insert({
        clickid,
        fbclid: body.fbclid ?? null,
        campaignid: parseUuid(body.campaignid ?? null) ?? null,
        adsetid: parseUuid(body.adsetid ?? null) ?? null,
        adid: parseUuid(body.adid ?? null) ?? null,
        utmsource: body.utmsource ?? null,
        utmcampaign: body.utmcampaign ?? null,
        utmcontent: body.utmcontent ?? null,
        ipaddress: ip || null,
        useragent: userAgent || null,
        devicetype: detectDevice(userAgent),
      })
      .select("clickid")
      .single();

    if (error) throw error;
    return NextResponse.json({ clickid: data.clickid }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

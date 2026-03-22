import { NextRequest, NextResponse } from "next/server";
import { generateClickId } from "@/lib/clickId";
import { detectDevice } from "@/lib/deviceDetect";
import { sendCAPIEvent } from "@/lib/metaConversions";
import { createServiceClient } from "@/lib/supabaseServer";
import { parseUuid } from "@/lib/uuid";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const fbclid = searchParams.get("fbclid");
  const utmsource =
    searchParams.get("utm_source") ?? searchParams.get("utmsource");
  const utmcampaign =
    searchParams.get("utm_campaign") ?? searchParams.get("utmcampaign");
  const utmcontent =
    searchParams.get("utm_content") ?? searchParams.get("utmcontent");
  const campaignid = parseUuid(searchParams.get("campaignid"));
  const adsetid = parseUuid(searchParams.get("adsetid"));
  const adid = parseUuid(searchParams.get("adid"));
  const productname = searchParams.get("product") ?? "";

  const userAgent = req.headers.get("user-agent") ?? "";
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "";
  const devicetype = detectDevice(userAgent);
  const clickid = generateClickId();

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured (Supabase service role)" },
      { status: 500 }
    );
  }

  const insertPromise = supabase.from("clicks").insert({
    clickid,
    fbclid,
    campaignid,
    adsetid,
    adid,
    utmsource,
    utmcampaign,
    utmcontent,
    ipaddress: ip || null,
    useragent: userAgent || null,
    devicetype,
  });

  const capiPromise = sendCAPIEvent({
    eventName: "InitiateCheckout",
    eventId: clickid,
    eventTime: Math.floor(Date.now() / 1000),
    fbclid,
    ipAddress: ip || null,
    userAgent: userAgent || null,
  });

  void Promise.all([insertPromise, capiPromise]).catch(console.error);

  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!phone) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_WHATSAPP_NUMBER is not set" },
      { status: 500 }
    );
  }

  const line = productname
    ? `Hi, I want to order ${productname}.\n\nCode: ${clickid}`
    : `Hi, I want to place an order.\n\nCode: ${clickid}`;
  const message = encodeURIComponent(line);

  return NextResponse.redirect(
    `https://wa.me/${phone.replace(/\D/g, "")}?text=${message}`,
    302
  );
}

/**
 * Tracking bridge: Meta ad click → `clicks` row + `leads` pre-lead
 * → WhatsApp deep link with human-readable order code.
 * Fires **Lead** CAPI event (gated).
 *
 * **Setup in Meta Ads Manager (once, at campaign level):**
 * ```
 * Website URL:     https://yourdomain.com/w
 * URL Parameters:  cid={{campaign.id}}&asid={{adset.id}}&aid={{ad.id}}&ad_name={{ad.name}}
 * ```
 * Meta auto-appends `fbclid`. No per-ad configuration needed.
 *
 * Also accepts legacy local UUIDs (campaignid/adsetid/adid) and
 * explicit `product=` param as overrides.
 *
 * @see lib/attribution.ts for order-time attribution priority.
 */
import { NextRequest, NextResponse } from "next/server";
import { generateClickId } from "@/lib/clickId";
import { detectDevice } from "@/lib/deviceDetect";
import { sendCAPIEvent } from "@/lib/meta/capi";
import { checkRateLimit } from "@/lib/rateLimit";
import { createServiceClient } from "@/lib/supabaseServer";
import { parseUuid } from "@/lib/uuid";
import { sanitizeRedirectProductName } from "@/lib/waRedirect";

function clientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

const AD_SUFFIX_RE = /\s*(image\s*\d*|video\s*\d*|carousel\s*\d*|reel\s*\d*|story\s*\d*|dpa\s*\d*)?\s*ad\s*\d*$/i;

/**
 * Extract a clean product name from a Meta ad name.
 * "CS02 Plus Image Ad"           → "CS02 Plus"
 * "R36 Led Headlight Image2 Ad"  → "R36 Led Headlight"
 * "Cordless Vacuum Cleaner Image Ad" → "Cordless Vacuum Cleaner"
 */
function productFromAdName(adName: string): string {
  return adName.replace(AD_SUFFIX_RE, "").trim();
}

export async function GET(req: NextRequest) {
  const ip = clientIp(req);
  const rl = checkRateLimit(`w:${ip}`, 90, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: rl.retryAfterMs
          ? { "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)) }
          : undefined,
      },
    );
  }

  const { searchParams } = new URL(req.url);

  // ── Meta auto-appended ──
  const fbclid = searchParams.get("fbclid");

  // ── From URL Parameters template ──
  const metaCampaignId = searchParams.get("cid") ?? searchParams.get("meta_campaign_id");
  const metaAdsetId = searchParams.get("asid") ?? searchParams.get("meta_adset_id");
  const metaAdId = searchParams.get("aid") ?? searchParams.get("meta_ad_id");
  const adName = searchParams.get("ad_name")?.trim() ?? "";

  // ── Legacy local UUIDs (optional override) ──
  let campaignid = parseUuid(searchParams.get("campaignid"));
  let adsetid = parseUuid(searchParams.get("adsetid"));
  let adid = parseUuid(searchParams.get("adid"));

  // ── UTM params (if configured) ──
  const utmsource =
    searchParams.get("utm_source") ?? searchParams.get("utmsource");
  const utmcampaign =
    searchParams.get("utm_campaign") ?? searchParams.get("utmcampaign");
  const utmcontent =
    searchParams.get("utm_content") ?? searchParams.get("utmcontent");

  // ── Product: explicit param > derived from ad name ──
  const explicitProduct = sanitizeRedirectProductName(
    searchParams.get("product") ?? "",
  );
  const derivedProduct = adName ? productFromAdName(adName) : "";
  const productname = explicitProduct || derivedProduct;

  const userAgent = req.headers.get("user-agent") ?? "";
  const devicetype = detectDevice(userAgent);
  const clickid = generateClickId();

  let supabase;
  try {
    supabase = createServiceClient();
  } catch {
    return NextResponse.json(
      { error: "Server misconfigured (Supabase service role)" },
      { status: 500 },
    );
  }

  // ── Resolve Meta IDs → local UUIDs (auto-create if missing) ──
  if (!campaignid && metaCampaignId) {
    const { data } = await supabase
      .from("campaigns")
      .select("id")
      .eq("metacampaignid", metaCampaignId)
      .maybeSingle();
    if (data) {
      campaignid = data.id;
    } else {
      const { data: created } = await supabase
        .from("campaigns")
        .insert({
          name: utmcampaign || `Campaign ${metaCampaignId}`,
          metacampaignid: metaCampaignId,
        })
        .select("id")
        .single();
      if (created) campaignid = created.id;
    }
  }

  if (!adsetid && metaAdsetId && campaignid) {
    const { data } = await supabase
      .from("adsets")
      .select("id")
      .eq("metaadsetid", metaAdsetId)
      .maybeSingle();
    if (data) {
      adsetid = data.id;
    } else {
      const { data: created } = await supabase
        .from("adsets")
        .insert({
          campaignid,
          name: `Adset ${metaAdsetId}`,
          metaadsetid: metaAdsetId,
        })
        .select("id")
        .single();
      if (created) adsetid = created.id;
    }
  }

  if (!adid && metaAdId && adsetid) {
    const { data } = await supabase
      .from("ads")
      .select("id")
      .eq("metaadid", metaAdId)
      .maybeSingle();
    if (data) {
      adid = data.id;
    } else {
      const { data: created } = await supabase
        .from("ads")
        .insert({
          adsetid,
          name: adName || `Ad ${metaAdId}`,
          metaadid: metaAdId,
        })
        .select("id")
        .single();
      if (created) adid = created.id;
    }
  }

  // ── Insert click row ──
  const { error: insertErr } = await supabase.from("clicks").insert({
    clickid,
    fbclid,
    campaignid,
    adsetid,
    adid,
    utmsource,
    utmcampaign,
    utmcontent,
    product: productname || null,
    ipaddress: ip === "unknown" ? null : ip || null,
    useragent: userAgent || null,
    devicetype,
  });

  if (insertErr) {
    console.error("clicks insert:", insertErr);
    return NextResponse.json(
      { error: "Tracking unavailable" },
      { status: 503 },
    );
  }

  // ── Create pre-lead (phone filled later when order comes in) ──
  await supabase
    .from("leads")
    .insert({ clickid, adid, phone: null })
    .then(({ error }) => {
      if (error) console.error("lead insert:", error);
    });

  // ── Fire Lead CAPI event (non-blocking) ──
  void sendCAPIEvent({
    eventName: "Lead",
    eventId: clickid,
    clickId: clickid,
    eventTime: Math.floor(Date.now() / 1000),
    fbclid,
    ipAddress: ip === "unknown" ? null : ip || null,
    userAgent: userAgent || null,
  }).catch(console.error);

  // ── Look up custom WhatsApp message from product catalog ──
  let waTemplate: string | null = null;
  if (productname) {
    const { data: matchedProduct } = await supabase
      .from("products")
      .select("wa_message")
      .ilike("name", productname)
      .maybeSingle();
    waTemplate = matchedProduct?.wa_message ?? null;
  }

  // ── Redirect to WhatsApp ──
  const phone = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER;
  if (!phone) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_WHATSAPP_NUMBER is not set" },
      { status: 500 },
    );
  }

  let line: string;
  if (waTemplate) {
    line = waTemplate
      .replace(/\{product\}/gi, productname)
      .replace(/\{code\}/gi, clickid);
  } else if (productname) {
    line = `Hi, I want to order ${productname}.\n\nCode: ${clickid}`;
  } else {
    line = `Hi, I want to place an order.\n\nCode: ${clickid}`;
  }
  const message = encodeURIComponent(line);

  return NextResponse.redirect(
    `https://wa.me/${phone.replace(/\D/g, "")}?text=${message}`,
    302,
  );
}

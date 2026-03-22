import type { AttributionMethod, AttributionResult, CreateOrderPayload } from "@/types";
import { createServiceClient } from "./supabaseServer";

interface AttributionInput extends CreateOrderPayload {
  ordertime: Date;
}

const TIMEWINDOW_MINUTES = 60;

export async function resolveAttribution(
  input: AttributionInput
): Promise<AttributionResult> {
  const supabase = createServiceClient();

  if (input.clickid) {
    const { data } = await supabase
      .from("clicks")
      .select("clickid, adid, campaignid")
      .eq("clickid", input.clickid.trim())
      .maybeSingle();

    if (data) {
      return {
        clickid: data.clickid,
        adid: data.adid,
        campaignid: data.campaignid,
        method: "clickid",
        confidence: 1,
      };
    }
  }

  if (input.adid) {
    const { data } = await supabase
      .from("ads")
      .select("id, adsets(campaignid)")
      .eq("id", input.adid)
      .maybeSingle();

    if (data) {
      const raw = data.adsets as
        | { campaignid: string }
        | { campaignid: string }[]
        | null;
      const adset = Array.isArray(raw) ? raw[0] : raw;
      return {
        clickid: null,
        adid: input.adid,
        campaignid: adset?.campaignid ?? null,
        method: "adid",
        confidence: 0.9,
      };
    }
  }

  const { data: phoneMatch } = await supabase
    .from("leads")
    .select("clickid, adid")
    .eq("phone", input.phone.trim())
    .order("createdat", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (phoneMatch) {
    let campaignid: string | null = null;
    if (phoneMatch.clickid) {
      const { data: click } = await supabase
        .from("clicks")
        .select("campaignid")
        .eq("clickid", phoneMatch.clickid)
        .maybeSingle();
      campaignid = click?.campaignid ?? null;
    }
    return {
      clickid: phoneMatch.clickid,
      adid: phoneMatch.adid,
      campaignid,
      method: "phone" as AttributionMethod,
      confidence: 0.8,
    };
  }

  const windowStart = new Date(
    input.ordertime.getTime() - TIMEWINDOW_MINUTES * 60 * 1000
  );

  const { data: windowMatch } = await supabase
    .from("clicks")
    .select("clickid, adid, campaignid")
    .gte("createdat", windowStart.toISOString())
    .lte("createdat", input.ordertime.toISOString())
    .order("createdat", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (windowMatch) {
    return {
      clickid: windowMatch.clickid,
      adid: windowMatch.adid,
      campaignid: windowMatch.campaignid,
      method: "timewindow",
      confidence: 0.6,
    };
  }

  if (input.items.length > 0) {
    const { data: campMatch } = await supabase
      .from("campaigns")
      .select("id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();

    if (campMatch) {
      return {
        clickid: null,
        adid: null,
        campaignid: campMatch.id,
        method: "productmatch",
        confidence: 0.4,
      };
    }
  }

  return {
    clickid: null,
    adid: null,
    campaignid: null,
    method: "unknown",
    confidence: 0,
  };
}

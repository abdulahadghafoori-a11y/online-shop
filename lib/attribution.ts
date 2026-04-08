import type { SupabaseClient } from "@supabase/supabase-js";
import type { AttributionResult, CreateOrderPayload } from "@/types";
import { phoneMatchVariants } from "@/lib/phoneNormalize";
import { createServiceClient } from "./supabaseServer";

interface AttributionInput extends CreateOrderPayload {
  ordertime: Date;
}

const TIMEWINDOW_MINUTES = 60;

async function adRowForId(
  supabase: SupabaseClient,
  adId: string,
): Promise<{ adsetid: string | null; campaignid: string | null } | null> {
  const { data } = await supabase
    .from("ads")
    .select("id, adsetid, adsets(campaignid)")
    .eq("id", adId)
    .maybeSingle();
  if (!data) return null;
  const raw = data.adsets as
    | { campaignid: string }
    | { campaignid: string }[]
    | null;
  const adset = Array.isArray(raw) ? raw[0] : raw;
  return {
    adsetid: data.adsetid ?? null,
    campaignid: adset?.campaignid ?? null,
  };
}

/**
 * Resolves click → Meta hierarchy for storage on orders.
 * Priority matches ops spec: click_id → ad_id → phone (lead / prior order) → time window → product (single active campaign only).
 */
export async function resolveAttribution(
  input: AttributionInput,
): Promise<AttributionResult> {
  const supabase = createServiceClient();

  if (input.clickid) {
    const { data } = await supabase
      .from("clicks")
      .select("clickid, adid, adsetid, campaignid")
      .eq("clickid", input.clickid.trim())
      .maybeSingle();

    if (data) {
      return {
        clickid: data.clickid,
        adid: data.adid,
        adsetid: data.adsetid,
        campaignid: data.campaignid,
        method: "clickid",
        confidence: 1,
      };
    }
  }

  if (input.adid) {
    const row = await adRowForId(supabase, input.adid);
    if (row) {
      return {
        clickid: null,
        adid: input.adid,
        adsetid: row.adsetid,
        campaignid: row.campaignid,
        method: "adid",
        confidence: 0.9,
      };
    }
  }

  const phone = input.phone.trim();
  const phoneKeys = phoneMatchVariants(phone);

  const { data: leadRows } = await supabase
    .from("leads")
    .select("clickid, adid")
    .in("phone", phoneKeys)
    .order("createdat", { ascending: false })
    .limit(1);
  const leadPhone = leadRows?.[0] ?? null;

  if (leadPhone) {
    if (leadPhone.clickid) {
      const { data: click } = await supabase
        .from("clicks")
        .select("clickid, adid, adsetid, campaignid")
        .eq("clickid", leadPhone.clickid)
        .maybeSingle();
      if (click) {
        return {
          clickid: click.clickid,
          adid: click.adid,
          adsetid: click.adsetid,
          campaignid: click.campaignid,
          method: "phone",
          confidence: 0.8,
        };
      }
    }
    if (leadPhone.adid) {
      const row = await adRowForId(supabase, leadPhone.adid);
      if (row?.campaignid) {
        return {
          clickid: null,
          adid: leadPhone.adid,
          adsetid: row.adsetid,
          campaignid: row.campaignid,
          method: "phone",
          confidence: 0.8,
        };
      }
    }
  }

  const { data: priorRows } = await supabase
    .from("orders")
    .select("clickid, adid, campaignid, adsetid")
    .in("phone", phoneKeys)
    .neq("status", "cancelled")
    .order("createdat", { ascending: false })
    .limit(1);
  const priorOrder = priorRows?.[0] ?? null;

  if (priorOrder?.clickid) {
    const { data: click } = await supabase
      .from("clicks")
      .select("clickid, adid, adsetid, campaignid")
      .eq("clickid", priorOrder.clickid)
      .maybeSingle();
    if (click) {
      return {
        clickid: click.clickid,
        adid: click.adid,
        adsetid: click.adsetid,
        campaignid: click.campaignid,
        method: "phone",
        confidence: 0.8,
      };
    }
  }
  if (priorOrder?.adid) {
    const row = await adRowForId(supabase, priorOrder.adid);
    if (row?.campaignid) {
      return {
        clickid: priorOrder.clickid,
        adid: priorOrder.adid,
        adsetid: row.adsetid ?? priorOrder.adsetid ?? null,
        campaignid: row.campaignid ?? priorOrder.campaignid ?? null,
        method: "phone",
        confidence: 0.8,
      };
    }
  }

  const windowStart = new Date(
    input.ordertime.getTime() - TIMEWINDOW_MINUTES * 60 * 1000,
  );

  const { data: scopedLeads } = await supabase
    .from("leads")
    .select("clickid")
    .in("phone", phoneKeys)
    .not("clickid", "is", null);

  const scopedClickIds = [
    ...new Set(
      (scopedLeads ?? [])
        .map((l) => l.clickid)
        .filter((c): c is string => Boolean(c)),
    ),
  ];

  if (scopedClickIds.length > 0) {
    const { data: windowMatch } = await supabase
      .from("clicks")
      .select("clickid, adid, adsetid, campaignid")
      .in("clickid", scopedClickIds)
      .gte("createdat", windowStart.toISOString())
      .lte("createdat", input.ordertime.toISOString())
      .order("createdat", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (windowMatch) {
      return {
        clickid: windowMatch.clickid,
        adid: windowMatch.adid,
        adsetid: windowMatch.adsetid,
        campaignid: windowMatch.campaignid,
        method: "timewindow",
        confidence: 0.6,
      };
    }
  }

  if (input.items.length > 0) {
    const { data: activeCamps } = await supabase
      .from("campaigns")
      .select("id")
      .eq("status", "active");

    if (activeCamps?.length === 1) {
      const onlyId = activeCamps[0]!.id;
      return {
        clickid: null,
        adid: null,
        adsetid: null,
        campaignid: onlyId,
        method: "productmatch",
        confidence: 0.4,
      };
    }
  }

  return {
    clickid: null,
    adid: null,
    adsetid: null,
    campaignid: null,
    method: "unknown",
    confidence: 0,
  };
}

/**
 * Meta Marketing API — campaigns, adsets, ads, and daily insights.
 *
 * All functions are server-only (they read process.env secrets).
 * Token needs `ads_read` + `ads_management` (or just `ads_read`) for the ad account.
 */

import { createServiceClient } from "@/lib/supabaseServer";

// ─── Types ──────────────────────────────────────────────────────

export type MetaCampaign = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  objective?: string;
  created_time?: string;
  updated_time?: string;
};

export type MetaAdSet = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  campaign_id?: string;
  created_time?: string;
};

export type MetaAd = {
  id: string;
  name: string;
  status?: string;
  effective_status?: string;
  adset_id?: string;
  campaign_id?: string;
  created_time?: string;
};

export type MetaInsightRow = {
  campaign_id: string;
  campaign_name: string;
  date_start: string;
  spend: string;
  clicks: string;
  impressions: string;
};

type FetchResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string; errorCode?: string };

export type SyncResult = {
  action: string;
  ok: boolean;
  count?: number;
  error?: string;
};

// ─── Config helpers ─────────────────────────────────────────────

function getMetaConfig() {
  const rawAccount = process.env.META_AD_ACCOUNT_ID?.trim();
  const token = process.env.META_MARKETING_ACCESS_TOKEN?.trim();
  const version = process.env.META_API_VERSION?.trim() || "v21.0";
  const actId = normalizeActId(rawAccount ?? "");
  return { actId, token, version };
}

function normalizeActId(raw: string): string {
  const digits = raw.replace(/^act_/i, "").trim();
  return digits && /^\d+$/.test(digits) ? `act_${digits}` : "";
}

function missingConfigError(
  what: string
): { ok: false; error: string; errorCode: string } {
  return {
    ok: false,
    error: `Add META_AD_ACCOUNT_ID and META_MARKETING_ACCESS_TOKEN to ${what}.`,
    errorCode: "missing_config",
  };
}

// ─── Generic paginated fetcher ──────────────────────────────────

async function fetchAllPages<T>(
  initialUrl: string,
  maxPages = 200
): Promise<FetchResult<T>> {
  const collected: T[] = [];
  let nextUrl: string | null = initialUrl;

  for (let page = 0; page < maxPages && nextUrl; page++) {
    const res = await fetch(nextUrl, { cache: "no-store" });
    const json = (await res.json()) as {
      data?: T[];
      paging?: { next?: string };
      error?: { message?: string; code?: number; type?: string };
    };

    if (!res.ok || json.error) {
      return {
        ok: false,
        error:
          json.error?.message ??
          (res.ok ? "Unknown Marketing API error" : `HTTP ${res.status}`),
        errorCode: json.error?.code?.toString() ?? json.error?.type,
      };
    }

    collected.push(...(json.data ?? []));
    nextUrl = json.paging?.next ?? null;
  }

  return { ok: true, data: collected };
}

function graphUrl(
  version: string,
  path: string,
  fields: string[],
  token: string,
  extra: Record<string, string> = {}
): string {
  const params = new URLSearchParams({
    fields: fields.join(","),
    limit: "500",
    access_token: token,
    ...extra,
  });
  return `https://graph.facebook.com/${version}/${path}?${params}`;
}

// ─── Fetch from Meta ────────────────────────────────────────────

export async function fetchMetaAdAccountCampaigns(): Promise<FetchResult<MetaCampaign>> {
  const { actId, token, version } = getMetaConfig();
  if (!actId || !token) return missingConfigError("load campaigns from Meta");

  return fetchAllPages<MetaCampaign>(
    graphUrl(version, `${actId}/campaigns`, [
      "id",
      "name",
      "status",
      "effective_status",
      "objective",
      "created_time",
      "updated_time",
    ], token)
  );
}

export async function fetchMetaAdSets(): Promise<FetchResult<MetaAdSet>> {
  const { actId, token, version } = getMetaConfig();
  if (!actId || !token) return missingConfigError("load ad sets from Meta");

  return fetchAllPages<MetaAdSet>(
    graphUrl(version, `${actId}/adsets`, [
      "id",
      "name",
      "status",
      "effective_status",
      "campaign_id",
      "created_time",
    ], token)
  );
}

export async function fetchMetaAds(): Promise<FetchResult<MetaAd>> {
  const { actId, token, version } = getMetaConfig();
  if (!actId || !token) return missingConfigError("load ads from Meta");

  return fetchAllPages<MetaAd>(
    graphUrl(version, `${actId}/ads`, [
      "id",
      "name",
      "status",
      "effective_status",
      "adset_id",
      "campaign_id",
      "created_time",
    ], token)
  );
}

export async function fetchMetaInsights(
  dateStart: string,
  dateEnd: string
): Promise<FetchResult<MetaInsightRow>> {
  const { actId, token, version } = getMetaConfig();
  if (!actId || !token) return missingConfigError("load insights from Meta");

  return fetchAllPages<MetaInsightRow>(
    graphUrl(
      version,
      `${actId}/insights`,
      ["campaign_id", "campaign_name", "spend", "clicks", "impressions"],
      token,
      {
        level: "campaign",
        time_increment: "1",
        time_range: JSON.stringify({
          since: dateStart,
          until: dateEnd,
        }),
      }
    )
  );
}

// ─── Sync to Supabase ───────────────────────────────────────────

export async function syncCampaignsToSupabase(): Promise<SyncResult> {
  const result = await fetchMetaAdAccountCampaigns();
  if (!result.ok) return { action: "syncCampaigns", ok: false, error: result.error };

  const supabase = createServiceClient();
  let upserted = 0;

  for (const c of result.data) {
    const { error } = await supabase.from("campaigns").upsert(
      {
        metacampaignid: c.id,
        name: c.name,
        platform: "facebook" as const,
        status: mapMetaStatus(c.effective_status ?? c.status),
      },
      { onConflict: "metacampaignid", ignoreDuplicates: false }
    );
    if (!error) upserted++;
  }

  return { action: "syncCampaigns", ok: true, count: upserted };
}

export async function syncAdSetsToSupabase(): Promise<SyncResult> {
  const result = await fetchMetaAdSets();
  if (!result.ok) return { action: "syncAdSets", ok: false, error: result.error };

  const supabase = createServiceClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, metacampaignid");
  const campaignMap = new Map(
    (campaigns ?? []).map((c) => [c.metacampaignid, c.id])
  );

  let upserted = 0;
  for (const a of result.data) {
    const campaignid = campaignMap.get(a.campaign_id ?? "") ?? null;
    if (!campaignid) continue;

    const { error } = await supabase.from("adsets").upsert(
      {
        metaadsetid: a.id,
        campaignid,
        name: a.name,
      },
      { onConflict: "metaadsetid", ignoreDuplicates: false }
    );
    if (!error) upserted++;
  }

  return { action: "syncAdSets", ok: true, count: upserted };
}

export async function syncAdsToSupabase(): Promise<SyncResult> {
  const result = await fetchMetaAds();
  if (!result.ok) return { action: "syncAds", ok: false, error: result.error };

  const supabase = createServiceClient();

  const { data: adsets } = await supabase
    .from("adsets")
    .select("id, metaadsetid");
  const adsetMap = new Map(
    (adsets ?? []).map((a) => [a.metaadsetid, a.id])
  );

  let upserted = 0;
  for (const ad of result.data) {
    const adsetid = adsetMap.get(ad.adset_id ?? "") ?? null;
    if (!adsetid) continue;

    const { error } = await supabase.from("ads").upsert(
      {
        metaadid: ad.id,
        adsetid,
        name: ad.name,
      },
      { onConflict: "metaadid", ignoreDuplicates: false }
    );
    if (!error) upserted++;
  }

  return { action: "syncAds", ok: true, count: upserted };
}

export async function syncInsightsToSupabase(
  dateStart: string,
  dateEnd: string
): Promise<SyncResult> {
  const result = await fetchMetaInsights(dateStart, dateEnd);
  if (!result.ok)
    return { action: "syncInsights", ok: false, error: result.error };

  const supabase = createServiceClient();

  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, metacampaignid");
  const campaignMap = new Map(
    (campaigns ?? []).map((c) => [c.metacampaignid, c.id])
  );

  let upserted = 0;
  for (const row of result.data) {
    const campaign_id = campaignMap.get(row.campaign_id) ?? null;
    if (!campaign_id) continue;

    const { error } = await supabase.from("daily_ad_insights").upsert(
      {
        campaign_id,
        adset_id: null,
        ad_id: null,
        date: row.date_start,
        spend: parseFloat(row.spend) || 0,
        clicks: parseInt(row.clicks, 10) || 0,
        impressions: parseInt(row.impressions, 10) || 0,
        source: "meta_api",
      },
      { onConflict: "dedupe_key", ignoreDuplicates: false }
    );
    if (!error) upserted++;
  }

  return { action: "syncInsights", ok: true, count: upserted };
}

// ─── Helpers ────────────────────────────────────────────────────

function mapMetaStatus(
  s: string | undefined
): "active" | "paused" | "stopped" {
  if (!s) return "stopped";
  const lower = s.toLowerCase();
  if (lower === "active") return "active";
  if (lower === "paused") return "paused";
  return "stopped";
}

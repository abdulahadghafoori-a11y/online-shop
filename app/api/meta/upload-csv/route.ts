import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/authApi";
import { createClient } from "@/lib/supabaseServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getCachedFxRates } from "@/lib/exchangeRates";

/**
 * Column name mapping — handles slight variations in Meta Ads Manager exports.
 * Keys are lowercase-trimmed header text.
 */
const COL = {
  campaignId: ["campaign id", "campaign_id"],
  campaignName: ["campaign name", "campaign_name"],
  adsetId: ["ad set id", "adset id", "adset_id", "ad_set_id"],
  adsetName: ["ad set name", "adset name", "adset_name", "ad_set_name"],
  adId: ["ad id", "ad_id"],
  adName: ["ad name", "ad_name"],
  reach: ["reach"],
  impressions: ["impressions"],
  frequency: ["frequency"],
  spend: ["amount spent (usd)", "amount spent", "spend", "cost"],
  clicks: ["link clicks", "clicks (all)", "clicks", "link_clicks", "clicks_all"],
  conversations: [
    "messaging conversations started",
    "messaging_conversations_started",
    "conversations",
  ],
  dateStart: ["reporting starts", "reporting_starts", "date_start", "date start", "day"],
  dateEnd: ["reporting ends", "reporting_ends", "date_stop", "date end"],
} as const;

function findCol(headers: string[], aliases: readonly string[]): number {
  for (const alias of aliases) {
    const idx = headers.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

function parseMetaDate(raw: string): string {
  const s = raw.trim();
  // MM-DD-YY or MM/DD/YY
  const mdy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (mdy) {
    const year = mdy[3].length === 2 ? `20${mdy[3]}` : mdy[3];
    return `${year}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return s;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === "\t") {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function usdToBase(
  usdAmount: number,
  base: "USD" | "AFN",
  afnPerUsd: number,
): number {
  return base === "AFN" ? usdAmount * afnPerUsd : usdAmount;
}

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { csv?: string };
  if (!body.csv || typeof body.csv !== "string") {
    return NextResponse.json({ error: "Missing csv text" }, { status: 400 });
  }

  const lines = body.csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return NextResponse.json(
      { error: "CSV must have a header row and at least one data row" },
      { status: 400 },
    );
  }

  const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const idx = {
    campaignId: findCol(headers, COL.campaignId),
    campaignName: findCol(headers, COL.campaignName),
    adsetId: findCol(headers, COL.adsetId),
    adsetName: findCol(headers, COL.adsetName),
    adId: findCol(headers, COL.adId),
    adName: findCol(headers, COL.adName),
    reach: findCol(headers, COL.reach),
    impressions: findCol(headers, COL.impressions),
    frequency: findCol(headers, COL.frequency),
    spend: findCol(headers, COL.spend),
    clicks: findCol(headers, COL.clicks),
    conversations: findCol(headers, COL.conversations),
    dateStart: findCol(headers, COL.dateStart),
  };

  if (idx.campaignId === -1)
    return NextResponse.json({ error: "Missing 'Campaign ID' column" }, { status: 400 });
  if (idx.spend === -1)
    return NextResponse.json({ error: "Missing 'Amount spent' column" }, { status: 400 });
  if (idx.dateStart === -1)
    return NextResponse.json({ error: "Missing 'Reporting starts' / date column" }, { status: 400 });

  const baseCurrency = getAmountBaseCurrency();
  const fx = await getCachedFxRates();

  const supabase = await createClient();

  // Cache for resolving Meta IDs → local UUIDs
  const campaignCache = new Map<string, string>();
  const adsetCache = new Map<string, string>();
  const adCache = new Map<string, string>();

  // Track which entities we've already updated names for (once per upload)
  const campaignNamesUpdated = new Set<string>();
  const adsetNamesUpdated = new Set<string>();
  const adNamesUpdated = new Set<string>();

  async function resolveCampaign(metaId: string, csvName: string): Promise<string | null> {
    if (campaignCache.has(metaId)) {
      if (csvName && !campaignNamesUpdated.has(metaId)) {
        campaignNamesUpdated.add(metaId);
        await supabase
          .from("campaigns")
          .update({ name: csvName })
          .eq("metacampaignid", metaId);
      }
      return campaignCache.get(metaId)!;
    }
    const { data } = await supabase
      .from("campaigns")
      .select("id")
      .eq("metacampaignid", metaId)
      .maybeSingle();
    if (data) {
      campaignCache.set(metaId, data.id);
      if (csvName && !campaignNamesUpdated.has(metaId)) {
        campaignNamesUpdated.add(metaId);
        await supabase
          .from("campaigns")
          .update({ name: csvName })
          .eq("metacampaignid", metaId);
      }
      return data.id;
    }
    return null;
  }

  async function resolveAdset(
    metaId: string,
    campaignUuid: string,
    csvName: string,
  ): Promise<string | null> {
    if (adsetCache.has(metaId)) {
      if (csvName && !adsetNamesUpdated.has(metaId)) {
        adsetNamesUpdated.add(metaId);
        await supabase
          .from("adsets")
          .update({ name: csvName })
          .eq("metaadsetid", metaId);
      }
      return adsetCache.get(metaId)!;
    }
    const { data } = await supabase
      .from("adsets")
      .select("id")
      .eq("metaadsetid", metaId)
      .maybeSingle();
    if (data) {
      adsetCache.set(metaId, data.id);
      if (csvName && !adsetNamesUpdated.has(metaId)) {
        adsetNamesUpdated.add(metaId);
        await supabase
          .from("adsets")
          .update({ name: csvName })
          .eq("metaadsetid", metaId);
      }
      return data.id;
    }
    const name = csvName || `Adset ${metaId}`;
    const { data: created } = await supabase
      .from("adsets")
      .insert({ campaignid: campaignUuid, name, metaadsetid: metaId })
      .select("id")
      .single();
    if (created) {
      adsetCache.set(metaId, created.id);
      return created.id;
    }
    return null;
  }

  async function resolveAd(
    metaId: string,
    adsetUuid: string,
    csvName: string,
  ): Promise<string | null> {
    if (adCache.has(metaId)) {
      if (csvName && !adNamesUpdated.has(metaId)) {
        adNamesUpdated.add(metaId);
        await supabase
          .from("ads")
          .update({ name: csvName })
          .eq("metaadid", metaId);
      }
      return adCache.get(metaId)!;
    }
    const { data } = await supabase
      .from("ads")
      .select("id")
      .eq("metaadid", metaId)
      .maybeSingle();
    if (data) {
      adCache.set(metaId, data.id);
      if (csvName && !adNamesUpdated.has(metaId)) {
        adNamesUpdated.add(metaId);
        await supabase
          .from("ads")
          .update({ name: csvName })
          .eq("metaadid", metaId);
      }
      return data.id;
    }
    const name = csvName || `Ad ${metaId}`;
    const { data: created } = await supabase
      .from("ads")
      .insert({ adsetid: adsetUuid, name, metaadid: metaId })
      .select("id")
      .single();
    if (created) {
      adCache.set(metaId, created.id);
      return created.id;
    }
    return null;
  }

  const errors: string[] = [];
  let upserted = 0;
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const metaCampaignId = cols[idx.campaignId] ?? "";
    const campaignName = idx.campaignName !== -1 ? (cols[idx.campaignName] ?? "").trim() : "";
    const metaAdsetId = idx.adsetId !== -1 ? (cols[idx.adsetId] ?? "") : "";
    const adsetName = idx.adsetName !== -1 ? (cols[idx.adsetName] ?? "").trim() : "";
    const metaAdId = idx.adId !== -1 ? (cols[idx.adId] ?? "") : "";
    const adName = idx.adName !== -1 ? (cols[idx.adName] ?? "").trim() : "";
    const spendUsd = parseFloat(cols[idx.spend] ?? "0") || 0;
    const impressions = parseInt(cols[idx.impressions] ?? "0", 10) || 0;
    const clicks = idx.clicks !== -1 ? parseInt(cols[idx.clicks] ?? "0", 10) || 0 : 0;
    const reach = idx.reach !== -1 ? parseInt(cols[idx.reach] ?? "0", 10) || 0 : 0;
    const frequency = idx.frequency !== -1 ? parseFloat(cols[idx.frequency] ?? "0") || 0 : 0;
    const conversations = idx.conversations !== -1 ? parseInt(cols[idx.conversations] ?? "0", 10) || 0 : 0;
    const dateRaw = cols[idx.dateStart] ?? "";
    const date = parseMetaDate(dateRaw);

    if (!metaCampaignId) {
      errors.push(`Row ${i + 1}: missing Campaign ID`);
      skipped++;
      continue;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`Row ${i + 1}: invalid date "${dateRaw}"`);
      skipped++;
      continue;
    }

    const campaignUuid = await resolveCampaign(metaCampaignId, campaignName);
    if (!campaignUuid) {
      const name = campaignName || `Campaign ${metaCampaignId}`;
      const { data: newCamp } = await supabase
        .from("campaigns")
        .insert({ name, metacampaignid: metaCampaignId })
        .select("id")
        .single();
      if (!newCamp) {
        errors.push(`Row ${i + 1}: failed to create campaign for Meta ID ${metaCampaignId}`);
        skipped++;
        continue;
      }
      campaignCache.set(metaCampaignId, newCamp.id);
    }

    const campId = campaignCache.get(metaCampaignId)!;
    let adsetUuid: string | null = null;
    let adUuid: string | null = null;

    if (metaAdsetId) {
      adsetUuid = await resolveAdset(metaAdsetId, campId, adsetName);
    }
    if (metaAdId && adsetUuid) {
      adUuid = await resolveAd(metaAdId, adsetUuid, adName);
    }

    const spendBase = usdToBase(spendUsd, baseCurrency, fx.afnPerUsd);

    const { error: upsertErr } = await supabase
      .from("daily_ad_insights")
      .upsert(
        {
          campaign_id: campId,
          adset_id: adsetUuid,
          ad_id: adUuid,
          date,
          spend: Math.round(spendBase * 100) / 100,
          clicks,
          impressions,
          source: "csv_upload",
          extra: { reach, frequency, conversations, spend_usd: spendUsd },
        },
        { onConflict: "dedupe_key", ignoreDuplicates: false },
      );

    if (upsertErr) {
      errors.push(`Row ${i + 1}: ${upsertErr.message}`);
      skipped++;
    } else {
      upserted++;
    }
  }

  return NextResponse.json({
    ok: true,
    upserted,
    skipped,
    total: lines.length - 1,
    errors: errors.slice(0, 20),
  });
}

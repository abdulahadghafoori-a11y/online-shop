import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { formatDbMoney } from "@/lib/formatDbMoney";
import {
  computeAdTotalsMap,
  ctrPercent,
  fetchAdsetInsightTotals,
  fetchAdsetRollupByDay,
  fetchCampaignAdsetGrainRows,
} from "@/lib/adInsightTotals";
import {
  getScalingForAdset,
  getScalingForAds,
  scalingLabelBadgeClass,
} from "@/lib/scalingReport";
import { DailyInsightTable } from "@/components/dashboard/DailyInsightTable";
import { InsightReportSummary } from "@/components/dashboard/InsightReportSummary";
import { ScalingDecisionCallout } from "@/components/dashboard/ScalingDecisionCallout";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AdRow = {
  id: string;
  name: string;
  metaadid: string | null;
  createdat: string | null;
};

type AdsetRow = {
  id: string;
  name: string;
  metaadsetid: string | null;
  createdat: string | null;
  campaignid: string | null;
};

type PageProps = {
  params: Promise<{ campaignId: string; adsetId: string }>;
};

export default async function AdsetDetailPage({ params }: PageProps) {
  const { campaignId, adsetId } = await params;
  if (
    !z.string().uuid().safeParse(campaignId).success ||
    !z.string().uuid().safeParse(adsetId).success
  ) {
    notFound();
  }

  const supabase = await createClient();

  const [
    displayCurrency,
    fx,
    { data: campaign },
    { data: adsetRaw },
    { data: ads },
    insightTotals,
    dailyRollup,
    breakdownRows,
  ] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
    supabase
      .from("campaigns")
      .select("id, name")
      .eq("id", campaignId)
      .maybeSingle(),
    supabase
      .from("adsets")
      .select("id, name, metaadsetid, createdat, campaignid")
      .eq("id", adsetId)
      .maybeSingle(),
    supabase
      .from("ads")
      .select("id, name, metaadid, createdat")
      .eq("adsetid", adsetId)
      .order("createdat", { ascending: false }),
    fetchAdsetInsightTotals(supabase, adsetId),
    fetchAdsetRollupByDay(supabase, adsetId, 90),
    fetchCampaignAdsetGrainRows(supabase, campaignId),
  ]);

  if (!campaign) notFound();
  const adset = adsetRaw as AdsetRow | null;
  if (!adset || adset.campaignid !== campaignId) notFound();

  const adRows = (ads ?? []) as AdRow[];
  const adIds = adRows.map((a) => a.id);
  const adTotals = computeAdTotalsMap(breakdownRows, adIds);

  const base = getAmountBaseCurrency();
  const money = (n: number) => formatDbMoney(n, displayCurrency, base, fx);

  const [adsetScaling, adScalingMap] = await Promise.all([
    getScalingForAdset(supabase, adsetId),
    getScalingForAds(supabase, adIds),
  ]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/dashboard/campaigns" className="hover:text-foreground">
          Campaigns
        </Link>
        <ChevronRight className="size-4 shrink-0 opacity-60" />
        <Link
          href={`/dashboard/campaigns/${campaignId}`}
          className="hover:text-foreground"
        >
          {campaign.name}
        </Link>
        <ChevronRight className="size-4 shrink-0 opacity-60" />
        <span className="text-foreground font-medium">{adset.name}</span>
      </div>

      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {adset.name}
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Daily stats from your uploads, plus 7-day scale / kill signals from
          spend vs sales. Parent:{" "}
          <Link
            href={`/dashboard/campaigns/${campaignId}`}
            className="text-primary font-medium hover:underline"
          >
            {campaign.name}
          </Link>
          .
        </p>
      </div>

      <ScalingDecisionCallout
        snapshot={adsetScaling}
        formatMoney={money}
        entityLabel="ad set"
      />

      <InsightReportSummary
        totals={insightTotals}
        formatMoney={money}
        footnote="Totals include all ad-day rows for this ad set (or ad-set–only rows if no ad breakdown exists)."
      />

      <Card>
        <CardHeader>
          <CardTitle>Daily delivery</CardTitle>
          <CardDescription>Spend and delivery by day for this ad set.</CardDescription>
        </CardHeader>
        <CardContent>
          <DailyInsightTable
            rows={dailyRollup}
            formatMoney={money}
            emptyMessage="No daily insight data for this ad set yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ads</CardTitle>
          <CardDescription>
            Delivery by creative; 7-day action compares insight spend to orders
            on each ad.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!adRows.length ? (
            <p className="text-muted-foreground text-sm">
              No ads in this ad set yet.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b text-left text-xs">
                    <th className="px-3 py-2 font-medium">Ad</th>
                    <th className="px-3 py-2 text-right font-medium">Spend</th>
                    <th className="px-3 py-2 text-right font-medium">Clicks</th>
                    <th className="px-3 py-2 text-right font-medium">Impr.</th>
                    <th className="px-3 py-2 text-right font-medium">Reach</th>
                    <th className="px-3 py-2 text-right font-medium">CTR</th>
                    <th className="px-3 py-2 text-center font-medium">7d</th>
                    <th className="px-3 py-2 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adRows.map((ad) => {
                    const t = adTotals.get(ad.id)!;
                    const sc = adScalingMap.get(ad.id)!;
                    return (
                      <tr key={ad.id}>
                        <td className="px-3 py-2 font-medium">{ad.name}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {money(t.spend)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {t.clicks.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {t.impressions.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {t.reach.toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {ctrPercent(t.clicks, t.impressions)}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <span
                            className={scalingLabelBadgeClass(sc.label)}
                            title={`${sc.orders} orders · ${money(sc.profit)} profit`}
                          >
                            {sc.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <Button variant="outline" size="sm" asChild>
                            <Link
                              href={`/dashboard/campaigns/${campaignId}/adsets/${adsetId}/ads/${ad.id}`}
                            >
                              Report
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Tracking:{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">
          /w?cid={"{{campaign.id}}"}&amp;asid={"{{adset.id}}"}&amp;aid={"{{ad.id}}"}
        </code>
        {adset.metaadsetid ? (
          <>
            {" "}
            · Meta ad set id{" "}
            <span className="font-mono">{adset.metaadsetid}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

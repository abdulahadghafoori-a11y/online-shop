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
  computeAdsetTotalsMap,
  ctrPercent,
  fetchCampaignAdsetGrainRows,
  fetchCampaignInsightTotals,
  fetchDailyadstatsSeries,
} from "@/lib/adInsightTotals";
import {
  getScalingForAdsetsUnderCampaign,
  getScalingForCampaign,
  scalingLabelBadgeClass,
} from "@/lib/scalingReport";
import { DailyInsightTable } from "@/components/dashboard/DailyInsightTable";
import { InsightReportSummary } from "@/components/dashboard/InsightReportSummary";
import { ScalingDecisionCallout } from "@/components/dashboard/ScalingDecisionCallout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type AdsetWithAds = {
  id: string;
  name: string;
  metaadsetid: string | null;
  createdat: string | null;
  ads: { id: string }[] | null;
};

type CampaignWithAdsets = {
  id: string;
  name: string;
  platform: string;
  status: string;
  metacampaignid: string | null;
  createdat: string | null;
  adsets: AdsetWithAds[] | null;
};

type PageProps = { params: Promise<{ campaignId: string }> };

export default async function CampaignDetailPage({ params }: PageProps) {
  const { campaignId } = await params;
  if (!z.string().uuid().safeParse(campaignId).success) notFound();

  const supabase = await createClient();
  const [
    displayCurrency,
    fx,
    { data: raw },
    insightTotals,
    breakdownRows,
    dailySeries,
    campaignScaling,
  ] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
    supabase
      .from("campaigns")
      .select(
        `
          id,
          name,
          platform,
          status,
          metacampaignid,
          createdat,
          adsets (
            id,
            name,
            metaadsetid,
            createdat,
            ads ( id )
          )
        `,
      )
      .eq("id", campaignId)
      .maybeSingle(),
    fetchCampaignInsightTotals(supabase, campaignId),
    fetchCampaignAdsetGrainRows(supabase, campaignId),
    fetchDailyadstatsSeries(supabase, campaignId, 90),
    getScalingForCampaign(supabase, campaignId),
  ]);

  const campaign = raw as CampaignWithAdsets | null;
  if (!campaign) notFound();

  const base = getAmountBaseCurrency();
  const money = (n: number) => formatDbMoney(n, displayCurrency, base, fx);

  const adsets = [...(campaign.adsets ?? [])].sort((a, b) => {
    const ta = a.createdat ? new Date(a.createdat).getTime() : 0;
    const tb = b.createdat ? new Date(b.createdat).getTime() : 0;
    return tb - ta;
  });

  const adsetTotals = computeAdsetTotalsMap(
    breakdownRows,
    adsets.map((a) => a.id),
  );

  const adsetScalingMap = await getScalingForAdsetsUnderCampaign(
    supabase,
    campaignId,
    adsets.map((a) => a.id),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
        <Link href="/dashboard/campaigns" className="hover:text-foreground">
          Campaigns
        </Link>
        <ChevronRight className="size-4 shrink-0 opacity-60" />
        <span className="text-foreground font-medium">{campaign.name}</span>
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            {campaign.name}
          </h1>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="secondary" className="capitalize">
              {campaign.platform}
            </Badge>
            <Badge variant="outline" className="capitalize">
              {campaign.status}
            </Badge>
          </div>
        </div>
      </div>

      <ScalingDecisionCallout
        snapshot={campaignScaling}
        formatMoney={money}
        entityLabel="campaign"
      />

      <InsightReportSummary
        totals={insightTotals}
        formatMoney={money}
        footnote="Campaign total uses the daily roll-up (all delivery rows for this campaign by day)."
      />

      <Card>
        <CardHeader>
          <CardTitle>Daily delivery</CardTitle>
          <CardDescription>
            One combined row per calendar day (matches reporting across ad /
            ad-set detail in Ads Manager).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DailyInsightTable
            rows={dailySeries}
            formatMoney={money}
            emptyMessage="No insight data for this campaign yet."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ad sets</CardTitle>
          <CardDescription>
            Delivery and a 7-day SCALE / WATCH / KILL hint from spend vs orders
            on ads in each ad set.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!adsets.length ? (
            <p className="text-muted-foreground text-sm">
              No ad sets yet. Run a Meta sync from the campaigns list.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-muted-foreground border-b text-left text-xs">
                    <th className="px-3 py-2 font-medium">Ad set</th>
                    <th className="px-3 py-2 text-right font-medium">Spend</th>
                    <th className="px-3 py-2 text-right font-medium">Clicks</th>
                    <th className="px-3 py-2 text-right font-medium">Impr.</th>
                    <th className="px-3 py-2 text-right font-medium">Reach</th>
                    <th className="px-3 py-2 text-right font-medium">CTR</th>
                    <th className="px-3 py-2 text-right font-medium">Ads</th>
                    <th className="px-3 py-2 text-center font-medium">7d</th>
                    <th className="px-3 py-2 text-right font-medium"> </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {adsets.map((aset) => {
                    const t = adsetTotals.get(aset.id)!;
                    const n = aset.ads?.length ?? 0;
                    const sc = adsetScalingMap.get(aset.id)!;
                    return (
                      <tr key={aset.id}>
                        <td className="px-3 py-2 font-medium">{aset.name}</td>
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
                        <td className="text-muted-foreground px-3 py-2 text-right tabular-nums">
                          {n}
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
                              href={`/dashboard/campaigns/${campaignId}/adsets/${aset.id}`}
                            >
                              Open
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
        {campaign.metacampaignid ? (
          <>
            Meta campaign ID{" "}
            <span className="font-mono">{campaign.metacampaignid}</span>
            {" · "}
            Ad tracking via{" "}
            <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">
              /w?cid={campaign.metacampaignid}&amp;aid={"{{ad.id}}"}
            </code>
          </>
        ) : (
          <>
            Local ID{" "}
            <span className="font-mono text-[0.7rem]">{campaign.id}</span>
          </>
        )}
      </p>
    </div>
  );
}

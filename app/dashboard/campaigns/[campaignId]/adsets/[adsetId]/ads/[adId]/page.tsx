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
  fetchAdInsightRows,
  sumInsightRows,
} from "@/lib/adInsightTotals";
import { getScalingForAd } from "@/lib/scalingReport";
import { DailyInsightTable } from "@/components/dashboard/DailyInsightTable";
import { InsightReportSummary } from "@/components/dashboard/InsightReportSummary";
import { ScalingDecisionCallout } from "@/components/dashboard/ScalingDecisionCallout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageProps = {
  params: Promise<{ campaignId: string; adsetId: string; adId: string }>;
};

export default async function AdDetailPage({ params }: PageProps) {
  const { campaignId, adsetId, adId } = await params;
  if (
    !z.string().uuid().safeParse(campaignId).success ||
    !z.string().uuid().safeParse(adsetId).success ||
    !z.string().uuid().safeParse(adId).success
  ) {
    notFound();
  }

  const supabase = await createClient();

  const [
    displayCurrency,
    fx,
    { data: campaign },
    { data: adset },
    { data: adRaw },
    insightRows,
    adScaling,
  ] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
    supabase.from("campaigns").select("id, name").eq("id", campaignId).maybeSingle(),
    supabase
      .from("adsets")
      .select("id, name, campaignid, metaadsetid")
      .eq("id", adsetId)
      .maybeSingle(),
    supabase
      .from("ads")
      .select("id, name, adsetid, metaadid")
      .eq("id", adId)
      .maybeSingle(),
    fetchAdInsightRows(supabase, adId),
    getScalingForAd(supabase, adId),
  ]);

  if (!campaign || !adset || !adRaw) notFound();
  if (adset.campaignid !== campaignId || adRaw.adsetid !== adsetId) notFound();

  const base = getAmountBaseCurrency();
  const money = (n: number) => formatDbMoney(n, displayCurrency, base, fx);
  const totals = sumInsightRows(insightRows);

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
        <Link
          href={`/dashboard/campaigns/${campaignId}/adsets/${adsetId}`}
          className="hover:text-foreground"
        >
          {adset.name}
        </Link>
        <ChevronRight className="size-4 shrink-0 opacity-60" />
        <span className="text-foreground font-medium">{adRaw.name}</span>
      </div>

      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          {adRaw.name}
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl text-sm">
          Full delivery history below; the callout uses the last 7 days to align
          with the dashboard scaling rules.
        </p>
      </div>

      <ScalingDecisionCallout
        snapshot={adScaling}
        formatMoney={money}
        entityLabel="ad"
      />

      <InsightReportSummary
        totals={totals}
        formatMoney={money}
        footnote="Rows are ad-level daily insights (one row per day when data exists)."
      />

      <Card>
        <CardHeader>
          <CardTitle>Daily delivery</CardTitle>
          <CardDescription>This ad, by day.</CardDescription>
        </CardHeader>
        <CardContent>
          <DailyInsightTable
            rows={insightRows}
            formatMoney={money}
            emptyMessage="No insight rows yet for this ad."
          />
        </CardContent>
      </Card>

      <p className="text-muted-foreground text-xs leading-relaxed">
        Tracking:{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-[0.7rem]">
          /w?cid={"{{campaign.id}}"}&amp;asid={"{{adset.id}}"}&amp;aid={"{{ad.id}}"}
        </code>
        {adRaw.metaadid ? (
          <>
            {" "}
            · Meta ad id <span className="font-mono">{adRaw.metaadid}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

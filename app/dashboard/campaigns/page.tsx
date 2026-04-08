import Link from "next/link";
import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { formatDbMoney } from "@/lib/formatDbMoney";
import { MetaCsvUpload } from "@/components/dashboard/MetaCsvUpload";
import { MetaSyncPanel } from "@/components/dashboard/MetaSyncPanel";
import {
  getScalingForCampaign,
  scalingLabelBadgeClass,
  type ScalingSnapshot,
} from "@/lib/scalingReport";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type LocalCampaign = {
  id: string;
  name: string;
  platform: string;
  status: string;
  metacampaignid: string | null;
  createdat: string | null;
};

export default async function CampaignsPage() {
  const supabase = await createClient();

  const [displayCurrency, fx, { data: localCampaigns }] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
    supabase
      .from("campaigns")
      .select("id, name, platform, status, metacampaignid, createdat")
      .order("createdat", { ascending: false }),
  ]);

  const campaigns = (localCampaigns ?? []) as LocalCampaign[];
  const campaignIds = campaigns.map((c) => c.id);

  const base = getAmountBaseCurrency();
  const money = (n: number) => formatDbMoney(n, displayCurrency, base, fx);

  let spendMap = new Map<string, number>();
  let orderCountMap = new Map<string, number>();
  let scalingMap = new Map<string, ScalingSnapshot>();

  if (campaignIds.length) {
    const [{ data: spendRows }, { data: orderRows }] = await Promise.all([
      supabase
        .from("daily_ad_insights")
        .select("campaign_id, spend")
        .in("campaign_id", campaignIds),
      supabase
        .from("orders")
        .select("campaignid")
        .in("campaignid", campaignIds)
        .neq("status", "cancelled"),
    ]);

    for (const r of spendRows ?? []) {
      const cid = r.campaign_id as string;
      spendMap.set(cid, (spendMap.get(cid) ?? 0) + Number(r.spend ?? 0));
    }

    for (const r of orderRows ?? []) {
      const cid = r.campaignid as string;
      orderCountMap.set(cid, (orderCountMap.get(cid) ?? 0) + 1);
    }

    const scalingResults = await Promise.all(
      campaignIds.map((id) => getScalingForCampaign(supabase, id)),
    );
    for (let i = 0; i < campaignIds.length; i++) {
      scalingMap.set(campaignIds[i], scalingResults[i]);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground text-sm">
          Sync campaigns via Meta API or upload a daily CSV export from Ads
          Manager. Ad tracking uses{" "}
          <code className="text-xs">
            /w?cid={"{{campaign.id}}"}&amp;aid={"{{ad.id}}"}
          </code>{" "}
          (set once per campaign in Meta URL parameters).
        </p>
      </div>

      <MetaCsvUpload />

      <details className="group">
        <summary className="flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium select-none hover:bg-muted/50">
          <span className="transition-transform group-open:rotate-90">▶</span>
          Meta API Sync
        </summary>
        <div className="mt-2">
          <MetaSyncPanel />
        </div>
      </details>

      <Card>
        <CardHeader>
          <CardTitle>Campaigns</CardTitle>
          <CardDescription>
            Campaigns synced from Meta or created via CSV uploads. Click a row to
            drill into ad sets and ads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Name</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 text-right font-medium">Spend</th>
                  <th className="px-3 py-2 text-right font-medium">Orders</th>
                  <th className="px-3 py-2 text-center font-medium">7d</th>
                  <th className="px-3 py-2 text-right font-medium"> </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {campaigns.map((c) => {
                  const totalSpend = spendMap.get(c.id) ?? 0;
                  const totalOrders = orderCountMap.get(c.id) ?? 0;
                  const sc = scalingMap.get(c.id);
                  return (
                    <tr key={c.id} className="text-foreground">
                      <td className="px-3 py-2">
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          className="text-primary font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
                        <span className="ml-2 text-xs text-muted-foreground capitalize">
                          {c.platform}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs capitalize">
                        {c.status}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {money(totalSpend)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {totalOrders}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {sc ? (
                          <span
                            className={scalingLabelBadgeClass(sc.label)}
                            title={`${sc.orders} orders · ${money(sc.profit)} profit (7d)`}
                          >
                            {sc.label}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Link
                          href={`/dashboard/campaigns/${c.id}`}
                          className="text-muted-foreground hover:text-foreground text-xs whitespace-nowrap"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!campaigns.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No campaigns yet — use <strong>Full sync</strong> above or
                upload a CSV to get started.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

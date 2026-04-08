import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ctrPercent, type InsightTotals } from "@/lib/adInsightTotals";

type Props = {
  totals: InsightTotals;
  formatMoney: (n: number) => string;
  /** Shown under the metric cards (e.g. data source note) */
  footnote?: string;
};

export function InsightReportSummary({
  totals,
  formatMoney,
  footnote,
}: Props) {
  const ctr = ctrPercent(totals.clicks, totals.impressions);
  const range =
    totals.firstDate && totals.lastDate
      ? totals.firstDate === totals.lastDate
        ? totals.firstDate
        : `${totals.firstDate} → ${totals.lastDate}`
      : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance</CardTitle>
        <CardDescription>
          Totals from imported / synced daily insights.{range ? ` ${range}.` : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Spend
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {formatMoney(totals.spend)}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Clicks
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {totals.clicks.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Impressions
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {totals.impressions.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Reach
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">
              {totals.reach.toLocaleString()}
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              CTR
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{ctr}</p>
          </div>
        </div>
        {totals.rowCount === 0 ? (
          <p className="text-muted-foreground text-sm">
            No insight rows yet. Import an Ads Manager export or run an insight
            sync.
          </p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {totals.rowCount} day
            {totals.rowCount === 1 ? "" : "s"} with delivery data in this roll-up.
          </p>
        )}
        {footnote ? (
          <p className="text-muted-foreground text-xs">{footnote}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

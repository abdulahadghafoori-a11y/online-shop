import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SCALE_PROFIT_PER_ORDER_MIN,
  SCALING_WINDOW_DAYS,
  scalingLabelBadgeClass,
  type ScalingSnapshot,
} from "@/lib/scalingReport";

type Props = {
  title?: string;
  snapshot: ScalingSnapshot;
  formatMoney: (n: number) => string;
  /** e.g. "campaign", "ad set", "ad" */
  entityLabel: string;
};

export function ScalingDecisionCallout({
  title = "Scaling decision",
  snapshot,
  formatMoney,
  entityLabel,
}: Props) {
  return (
    <Card className="border-primary/15">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <CardDescription>
            Last {snapshot.windowDays} days (since {snapshot.sinceDate}): uploaded
            delivery spend vs shop orders attributed to this {entityLabel}. SCALE
            if profit per order ≥ {formatMoney(SCALE_PROFIT_PER_ORDER_MIN)}; WATCH if
            still profitable; KILL if not.
          </CardDescription>
        </div>
        <span className={cn("inline-flex shrink-0", scalingLabelBadgeClass(snapshot.label, false))}>
          {snapshot.label}
        </span>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Spend
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {formatMoney(snapshot.spend)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Revenue
            </dt>
            <dd className="mt-0.5 font-medium tabular-nums">
              {formatMoney(snapshot.revenue)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Profit
            </dt>
            <dd
              className={cn(
                "mt-0.5 font-semibold tabular-nums",
                snapshot.profit >= 0
                  ? "text-green-600 dark:text-green-500"
                  : "text-destructive",
              )}
            >
              {formatMoney(snapshot.profit)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Orders
            </dt>
            <dd className="mt-0.5 tabular-nums">{snapshot.orders}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              ROAS
            </dt>
            <dd className="text-muted-foreground mt-0.5 tabular-nums">
              {snapshot.roas.toFixed(2)}×
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Profit / order
            </dt>
            <dd className="mt-0.5 tabular-nums">
              {formatMoney(snapshot.profitperorder)}
            </dd>
          </div>
        </dl>
      </CardContent>
    </Card>
  );
}

/** Re-export for copy that references the window without importing snapshot */
export { SCALING_WINDOW_DAYS };

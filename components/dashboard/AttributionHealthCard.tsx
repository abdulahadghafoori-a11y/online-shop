import Link from "next/link";
import { createClient } from "@/lib/supabaseServer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const WEAK_CONFIDENCE_LT = 0.5;
const SINCE_DAYS = 30;

/**
 * System health: share of recent orders with weak attribution (confidence &lt; 0.5).
 * Drives reliability of campaign / ad-set / product dashboards.
 */
export async function AttributionHealthCard() {
  const supabase = await createClient();
  const since = new Date(
    Date.now() - SINCE_DAYS * 864e5,
  ).toISOString();

  const [weakRes, totalRes, unknownRes] = await Promise.all([
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("createdat", since)
      .lt("confidencescore", WEAK_CONFIDENCE_LT),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("createdat", since),
    supabase
      .from("orders")
      .select("id", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("createdat", since)
      .eq("attributionmethod", "unknown"),
  ]);

  const weak = weakRes.count ?? 0;
  const total = totalRes.count ?? 0;
  const unknown = unknownRes.count ?? 0;
  const pctWeak = total > 0 ? Math.round((weak / total) * 100) : 0;

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Attribution health</CardTitle>
        <CardDescription>
          Last {SINCE_DAYS} days (non-cancelled orders): low-confidence matches
          inflate CPA and scaling signals. Aim to capture the WhatsApp{" "}
          <strong>order code</strong> on every sale.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-muted-foreground">Weak / total</span>
          <span className="font-medium tabular-nums">
            {weak} / {total}{" "}
            {total > 0 ? (
              <span className="text-muted-foreground">({pctWeak}%)</span>
            ) : null}
          </span>
        </div>
        <div className="flex flex-wrap justify-between gap-2">
          <span className="text-muted-foreground">Unknown method</span>
          <span className="font-medium tabular-nums">{unknown}</span>
        </div>
        <p className="text-muted-foreground pt-1 text-xs">
          Weak = confidence &lt; {WEAK_CONFIDENCE_LT}. See method + score on each{" "}
          <Link href="/dashboard/orders" className="text-primary underline-offset-4 hover:underline">
            order
          </Link>
          .
        </p>
      </CardContent>
    </Card>
  );
}

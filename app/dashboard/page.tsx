import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { formatDbMoney } from "@/lib/formatDbMoney";
import { AttributionHealthCard } from "@/components/dashboard/AttributionHealthCard";
import { FunnelWidget } from "@/components/dashboard/FunnelWidget";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ScalingTable } from "@/components/dashboard/ScalingTable";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [currency, fx] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
  ]);
  const amountBase = getAmountBaseCurrency();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5)
    .toISOString()
    .split("T")[0];

  const [
    { count: totalOrders },
    { count: totalClicks },
    { data: revenueData },
    { data: spendData },
    { data: deliveryData },
  ] = await Promise.all([
    supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .neq("status", "cancelled")
      .gte("createdat", thirtyDaysAgo),
    supabase
      .from("clicks")
      .select("*", { count: "exact", head: true })
      .gte("createdat", thirtyDaysAgo),
    supabase
      .from("orderitems")
      .select("saleprice, quantity, product_cost_snapshot, orders!inner(status, createdat)")
      .neq("orders.status", "cancelled")
      .gte("orders.createdat", thirtyDaysAgo),
    supabase
      .from("dailyadstats")
      .select("spend")
      .gte("date", thirtyDaysAgo),
    supabase
      .from("orders")
      .select("deliverycost")
      .neq("status", "cancelled")
      .gte("createdat", thirtyDaysAgo),
  ]);

  let revenue = 0;
  let cogs = 0;
  for (const i of revenueData ?? []) {
    revenue += Number(i.saleprice) * Number(i.quantity);
    cogs += Number(i.product_cost_snapshot) * Number(i.quantity);
  }
  const spend = spendData?.reduce((s, r) => s + Number(r.spend), 0) ?? 0;
  const delivery = deliveryData?.reduce((s, r) => s + Number(r.deliverycost), 0) ?? 0;
  const profit = revenue - cogs - delivery - spend;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold tracking-tight">
        Overview — last 30 days
      </h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <MetricCard label="Clicks" value={totalClicks ?? 0} />
        <MetricCard label="Orders" value={totalOrders ?? 0} />
        <MetricCard
          label="Revenue"
          value={formatDbMoney(revenue, currency, amountBase, fx)}
        />
        <MetricCard
          label="Profit"
          value={formatDbMoney(profit, currency, amountBase, fx)}
          variant={profit >= 0 ? "positive" : "negative"}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <FunnelWidget />
        <ScalingTable />
        <AttributionHealthCard />
      </div>
    </div>
  );
}

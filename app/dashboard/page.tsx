import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getCachedUsdAfnRate } from "@/lib/exchangeRates";
import { formatDbMoney } from "@/lib/formatDbMoney";
import { FunnelWidget } from "@/components/dashboard/FunnelWidget";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { ScalingTable } from "@/components/dashboard/ScalingTable";

export default async function DashboardPage() {
  const supabase = await createClient();
  const [currency, fx] = await Promise.all([
    getAppCurrency(),
    getCachedUsdAfnRate(),
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
      .select("saleprice, quantity, orders!inner(status, createdat)")
      .neq("orders.status", "cancelled")
      .gte("orders.createdat", thirtyDaysAgo),
    supabase
      .from("dailyadstats")
      .select("spend")
      .gte("date", thirtyDaysAgo),
  ]);

  const revenue =
    revenueData?.reduce((s, i) => s + i.saleprice * i.quantity, 0) ?? 0;
  const spend = spendData?.reduce((s, r) => s + Number(r.spend), 0) ?? 0;
  const profit = revenue - spend;

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
          value={formatDbMoney(revenue, currency, amountBase, fx.afnPerUsd)}
        />
        <MetricCard
          label="Profit"
          value={formatDbMoney(profit, currency, amountBase, fx.afnPerUsd)}
          variant={profit >= 0 ? "positive" : "negative"}
        />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <FunnelWidget />
        <ScalingTable />
      </div>
    </div>
  );
}

import Link from "next/link";
import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { formatDbMoney } from "@/lib/formatDbMoney";
import { parseReportDateParam, todayISO } from "@/lib/reportDateRange";
import { OrderFilters } from "@/components/dashboard/OrderFilters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PAGE_SIZE = 50;
const VALID_STATUSES = ["pending", "confirmed", "shipped", "delivered", "cancelled"];

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function OrdersPage({ searchParams }: Props) {
  const sp = await searchParams;
  const status = typeof sp.status === "string" && VALID_STATUSES.includes(sp.status)
    ? sp.status
    : undefined;
  const phone = typeof sp.phone === "string" ? sp.phone.trim() : "";
  const from = parseReportDateParam(
    typeof sp.from === "string" ? sp.from : null,
    "",
  );
  const to = parseReportDateParam(
    typeof sp.to === "string" ? sp.to : null,
    "",
  );
  const pageNum = Math.max(1, parseInt(String(sp.page ?? "1"), 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const supabase = await createClient();
  const [displayCurrency, fx] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
  ]);
  const base = getAmountBaseCurrency();
  const money = (n: number) => formatDbMoney(n, displayCurrency, base, fx);

  let query = supabase
    .from("orders")
    .select(
      `id, phone, status, createdat, deliveryaddress, confidencescore, attributionmethod, campaignid,
       campaigns ( name ),
       orderitems ( quantity, saleprice )`,
      { count: "exact" },
    )
    .order("createdat", { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1);

  if (status) query = query.eq("status", status);
  if (phone) query = query.ilike("phone", `%${phone}%`);
  if (from) query = query.gte("createdat", `${from}T00:00:00.000Z`);
  if (to) query = query.lt("createdat", `${to}T00:00:00.000Z`);

  const { data: orders, count } = await query;
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE);

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (phone) params.set("phone", phone);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return `/dashboard/orders${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
          <p className="text-muted-foreground text-sm">
            {count != null ? `${count} order${count === 1 ? "" : "s"} found` : "Loading…"}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/orders/new">New order</Link>
        </Button>
      </div>

      <OrderFilters
        currentStatus={status ?? ""}
        currentPhone={phone}
        currentFrom={from}
        currentTo={to}
      />

      <Card>
        <CardHeader>
          <CardTitle>All orders</CardTitle>
          <CardDescription>Attribution and status at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 pr-4 font-medium">Phone</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Province</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                  <th className="pb-2 pr-4 font-medium">Campaign</th>
                  <th className="pb-2 pr-4 font-medium">Method</th>
                  <th className="pb-2 pr-2 text-right font-medium">Open</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(orders ?? []).map((o) => {
                  const items = (o.orderitems ?? []) as { quantity: number; saleprice: number }[];
                  const total = items.reduce((s, i) => s + Number(i.saleprice) * i.quantity, 0);
                  const camp = o.campaigns && !Array.isArray(o.campaigns)
                    ? (o.campaigns as { name: string }).name
                    : null;
                  const statusVariant =
                    o.status === "delivered" ? "default" as const
                    : o.status === "cancelled" ? "destructive" as const
                    : "secondary" as const;
                  return (
                    <tr key={o.id} className="text-foreground">
                      <td className="py-2 pr-4 whitespace-nowrap">
                        {new Date(o.createdat).toLocaleDateString()}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{o.phone}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={statusVariant} className="capitalize">
                          {o.status}
                        </Badge>
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground">
                        {o.deliveryaddress ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums font-medium">
                        {money(total)}
                      </td>
                      <td className="py-2 pr-4 max-w-[120px] truncate text-muted-foreground text-xs">
                        {camp ? (
                          <Link
                            href={`/dashboard/campaigns/${o.campaignid}`}
                            className="text-primary hover:underline"
                          >
                            {camp}
                          </Link>
                        ) : "—"}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground text-xs">
                        {o.attributionmethod ?? "—"}
                      </td>
                      <td className="py-2 text-right">
                        <Link
                          href={`/dashboard/orders/${o.id}`}
                          className="text-primary text-sm font-medium hover:underline"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!orders?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No orders match the current filters.
              </p>
            ) : null}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              {pageNum > 1 && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(pageNum - 1)}>Previous</Link>
                </Button>
              )}
              <span className="text-muted-foreground text-sm tabular-nums">
                Page {pageNum} of {totalPages}
              </span>
              {pageNum < totalPages && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={pageHref(pageNum + 1)}>Next</Link>
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

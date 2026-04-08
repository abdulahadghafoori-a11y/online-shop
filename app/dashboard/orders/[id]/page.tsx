import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { formatDbMoney } from "@/lib/formatDbMoney";
import { formatStoredPhoneForDisplay } from "@/lib/phoneDisplayFromE164";
import { OrderDetailToolbar } from "@/components/dashboard/OrderDetailToolbar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageProps = { params: Promise<{ id: string }> };

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const [displayCurrency, fx] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
  ]);
  const base = getAmountBaseCurrency();
  const money = (n: number) => formatDbMoney(n, displayCurrency, base, fx);

  const { data: order } = await supabase
    .from("orders")
    .select(
      `
      id,
      phone,
      status,
      createdat,
      updatedat,
      deliveryaddress,
      trackingnumber,
      deliverycost,
      allocatedadspend,
      notes,
      clickid,
      adid,
      adsetid,
      campaignid,
      attributionmethod,
      confidencescore,
      campaigns ( name ),
      orderitems (
        id,
        quantity,
        saleprice,
        product_cost_snapshot,
        products ( name, sku )
      )
    `,
    )
    .eq("id", id)
    .maybeSingle();

  if (!order) notFound();

  type AttributedOrder = typeof order & {
    campaignid: string | null;
    adsetid: string | null;
    adid: string | null;
  };
  const o = order as AttributedOrder;

  type OI = {
    id: string;
    quantity: number;
    saleprice: number;
    product_cost_snapshot: number | null;
    products:
      | { name: string; sku: string }
      | { name: string; sku: string }[]
      | null;
  };

  const lines = (order.orderitems ?? []) as OI[];
  const lineTotal = lines.reduce(
    (s, l) => s + Number(l.saleprice) * l.quantity,
    0,
  );
  const totalCogs = lines.reduce(
    (s, l) => s + Number(l.product_cost_snapshot ?? 0) * l.quantity,
    0,
  );
  const delivery = Number(order.deliverycost ?? 0);
  const adSpend = Number(order.allocatedadspend ?? 0);
  const revenue = lineTotal;
  const grossProfit = revenue - totalCogs - delivery;
  const netProfit = grossProfit - adSpend;

  const campaignName =
    order.campaigns && !Array.isArray(order.campaigns)
      ? (order.campaigns as { name: string }).name
      : null;

  const phoneDisplay = formatStoredPhoneForDisplay(order.phone);

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/dashboard/orders"
          className="text-muted-foreground hover:text-foreground text-sm"
        >
          ← Orders
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">
          Order{" "}
          <span className="text-muted-foreground font-mono text-base font-normal">
            {String(order.id).slice(0, 8)}…
          </span>
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Created {new Date(order.createdat).toLocaleString()}
          {order.updatedat ? (
            <span className="ml-3">
              · Updated {new Date(order.updatedat).toLocaleString()}
            </span>
          ) : null}
        </p>
      </div>

      <OrderDetailToolbar
        orderId={order.id}
        status={order.status}
        deliveryaddress={order.deliveryaddress}
        trackingnumber={order.trackingnumber}
        notes={order.notes}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Customer and delivery</CardTitle>
            <CardDescription>Contact and ship-to province.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Phone</span>
              <span className="text-right text-xs leading-relaxed tracking-wide">
                {phoneDisplay}
              </span>
            </div>
            {phoneDisplay !== order.phone ? (
              <p className="text-muted-foreground mt-1 text-xs">
                Stored:{" "}
                <span className="font-mono text-[0.7rem]">{order.phone}</span>
              </p>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Province</span>
              <span className="text-right font-medium">
                {order.deliveryaddress}
              </span>
            </div>
            {order.trackingnumber ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tracking</span>
                <span className="max-w-[60%] text-right font-mono text-xs break-all">
                  {order.trackingnumber}
                </span>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <span className="capitalize">{order.status}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Attribution</CardTitle>
            <CardDescription>How this order was matched to ads.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Method</span>
              <span>{order.attributionmethod ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Confidence</span>
              <span className="tabular-nums">
                {order.confidencescore != null
                  ? Number(order.confidencescore).toFixed(2)
                  : "—"}
              </span>
            </div>
            {order.clickid ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Click ID</span>
                <span className="font-mono text-xs break-all">
                  {order.clickid}
                </span>
              </div>
            ) : null}
            {o.campaignid ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Campaign</span>
                <Link
                  href={`/dashboard/campaigns/${o.campaignid}`}
                  className="text-primary max-w-[65%] truncate text-right text-xs hover:underline"
                >
                  {campaignName ?? "Open in dashboard"}
                </Link>
              </div>
            ) : null}
            {o.adsetid && o.campaignid ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ad set</span>
                <Link
                  href={`/dashboard/campaigns/${o.campaignid}/adsets/${o.adsetid}`}
                  className="text-primary text-right text-xs hover:underline"
                >
                  Open ad set
                </Link>
              </div>
            ) : null}
            {o.adid && o.campaignid && o.adsetid ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Ad</span>
                <Link
                  href={`/dashboard/campaigns/${o.campaignid}/adsets/${o.adsetid}/ads/${o.adid}`}
                  className="text-primary text-right text-xs hover:underline"
                >
                  Open ad report
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Line items</CardTitle>
          <CardDescription>Prices shown in your display currency.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-3 font-medium">Product</th>
                  <th className="p-3 font-medium">SKU</th>
                  <th className="p-3 text-right font-medium">Qty</th>
                  <th className="p-3 text-right font-medium">Unit</th>
                  <th className="p-3 text-right font-medium">Cost</th>
                  <th className="p-3 text-right font-medium">Line</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => {
                  const p = Array.isArray(l.products)
                    ? l.products[0]
                    : l.products;
                  const unit = Number(l.saleprice);
                  const cost = Number(l.product_cost_snapshot ?? 0);
                  const q = l.quantity;
                  return (
                    <tr key={l.id}>
                      <td className="p-3 font-medium">{p?.name ?? "—"}</td>
                      <td className="text-muted-foreground p-3 font-mono text-xs">
                        {p?.sku ?? "—"}
                      </td>
                      <td className="p-3 text-right tabular-nums">{q}</td>
                      <td className="p-3 text-right tabular-nums">
                        {money(unit)}
                      </td>
                      <td className="text-muted-foreground p-3 text-right tabular-nums">
                        {money(cost)}
                      </td>
                      <td className="p-3 text-right font-medium tabular-nums">
                        {money(unit * q)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-4 space-y-2 border-t pt-4 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Revenue</span>
              <span className="tabular-nums font-medium">{money(revenue)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">COGS</span>
              <span className="tabular-nums font-medium">−{money(totalCogs)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Delivery</span>
              <span className="tabular-nums font-medium">−{money(delivery)}</span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-2">
              <span className="font-medium">Gross profit</span>
              <span className={`tabular-nums font-semibold ${grossProfit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                {money(grossProfit)}
              </span>
            </div>
            {adSpend > 0 ? (
              <>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Allocated ad spend</span>
                  <span className="tabular-nums font-medium">−{money(adSpend)}</span>
                </div>
                <div className="flex justify-between gap-4 border-t pt-2">
                  <span className="font-medium">Net profit</span>
                  <span className={`tabular-nums font-semibold ${netProfit < 0 ? "text-destructive" : "text-emerald-600"}`}>
                    {money(netProfit)}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

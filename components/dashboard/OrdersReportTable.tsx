"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";
import type { OrderProfitReportRow } from "@/types";

export function OrdersReportTable() {
  const { formatMoney } = useAppCurrency();
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [rows, setRows] = useState<OrderProfitReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ from: fromDate, to: toDate });
    const res = await fetch(`/api/reports/orders?${q}`);
    const j = await res.json();
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Report failed");
      setRows([]);
      setLoading(false);
      return;
    }
    const raw = (j.data ?? []) as Record<string, unknown>[];
    setRows(
      raw.map((r) => ({
        order_id: String(r.order_id),
        phone: r.phone == null ? null : String(r.phone),
        status: String(r.status),
        created_at: String(r.created_at),
        revenue: Number(r.revenue),
        cogs: Number(r.cogs),
        delivery_cost: Number(r.delivery_cost),
        allocated_ad_spend: Number(r.allocated_ad_spend),
        profit: Number(r.profit),
        line_items: Number(r.line_items),
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const totals = rows.reduce(
    (acc, r) => ({
      revenue: acc.revenue + r.revenue,
      cogs: acc.cogs + r.cogs,
      delivery: acc.delivery + r.delivery_cost,
      ads: acc.ads + r.allocated_ad_spend,
      profit: acc.profit + r.profit,
    }),
    { revenue: 0, cogs: 0, delivery: 0, ads: 0, profit: 0 },
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Order profit</CardTitle>
        <CardDescription>
          Per-order revenue, COGS (
          <code className="text-xs">product_cost_snapshot</code>), delivery,
          allocated ad spend, and profit. Source:{" "}
          <code className="text-xs">orders_profit_report</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="orders-from">From</Label>
            <Input
              id="orders-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="orders-to">To</Label>
            <Input
              id="orders-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Run report"}
          </Button>
        </div>

        {rows.length > 0 ? (
          <div className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-5">
            <div>
              <span className="block uppercase">Orders</span>
              <span className="font-medium text-foreground">{rows.length}</span>
            </div>
            <div>
              <span className="block uppercase">Revenue</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.revenue)}
              </span>
            </div>
            <div>
              <span className="block uppercase">COGS</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.cogs)}
              </span>
            </div>
            <div>
              <span className="block uppercase">Delivery + ads</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.delivery + totals.ads)}
              </span>
            </div>
            <div>
              <span className="block uppercase">Profit</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.profit)}
              </span>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                <th className="pb-2 font-medium">Date</th>
                <th className="pb-2 font-medium">Phone</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Lines</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">COGS</th>
                <th className="pb-2 text-right font-medium">Delivery</th>
                <th className="pb-2 text-right font-medium">Ad alloc.</th>
                <th className="pb-2 text-right font-medium">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.order_id}>
                  <td className="py-2 tabular-nums">
                    {new Date(r.created_at).toLocaleString(undefined, {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </td>
                  <td className="py-2">{r.phone ?? "—"}</td>
                  <td className="py-2 capitalize">{r.status}</td>
                  <td className="py-2 text-right tabular-nums">
                    {r.line_items}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(r.revenue)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(r.cogs)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(r.delivery_cost)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {formatMoney(r.allocated_ad_spend)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    {formatMoney(r.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No orders in range (non-cancelled only).
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

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
import type { ProductReport } from "@/types";

export function ProductReportTable() {
  const { formatMoney } = useAppCurrency();
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [rows, setRows] = useState<ProductReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ from: fromDate, to: toDate });
    const res = await fetch(`/api/reports/product?${q}`);
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
        productid: String(r.productid),
        productname: String(r.productname),
        unitssold: Number(r.unitssold),
        revenue: Number(r.revenue),
        cost: Number(r.cost),
        profit: Number(r.profit),
      }))
    );
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  const totals = rows.reduce(
    (acc, r) => ({
      units: acc.units + r.unitssold,
      revenue: acc.revenue + r.revenue,
      cost: acc.cost + r.cost,
      profit: acc.profit + r.profit,
    }),
    { units: 0, revenue: 0, cost: 0, profit: 0 }
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Product profit</CardTitle>
        <CardDescription>
          Sales by SKU for the date range (non-cancelled orders). Revenue minus
          COGS uses <code className="text-xs">product_cost_snapshot</code> per
          line from <code className="text-xs">productprofitreport</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="prod-from">From</Label>
            <Input
              id="prod-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="prod-to">To</Label>
            <Input
              id="prod-to"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <Button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Run report"}
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                <th className="pb-2 font-medium">Product</th>
                <th className="pb-2 text-right font-medium">Units</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">COGS</th>
                <th className="pb-2 text-right font-medium">Profit</th>
                <th className="pb-2 text-right font-medium">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const marginPct =
                  r.revenue > 0 ? (r.profit / r.revenue) * 100 : null;
                return (
                  <tr key={r.productid}>
                    <td className="py-2 font-medium">{r.productname}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.unitssold}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(r.revenue)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {formatMoney(r.cost)}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatMoney(r.profit)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {marginPct != null && Number.isFinite(marginPct)
                        ? `${marginPct.toFixed(1)}%`
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {rows.length > 0 ? (
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="pt-2">Totals</td>
                  <td className="pt-2 text-right tabular-nums">{totals.units}</td>
                  <td className="pt-2 text-right tabular-nums">
                    {formatMoney(totals.revenue)}
                  </td>
                  <td className="pt-2 text-right tabular-nums text-muted-foreground">
                    {formatMoney(totals.cost)}
                  </td>
                  <td className="pt-2 text-right tabular-nums">
                    {formatMoney(totals.profit)}
                  </td>
                  <td className="pt-2 text-right tabular-nums text-muted-foreground">
                    {totals.revenue > 0
                      ? `${((totals.profit / totals.revenue) * 100).toFixed(1)}%`
                      : "—"}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
          {!rows.length && !loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No rows in this range — confirm orders and line items exist.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

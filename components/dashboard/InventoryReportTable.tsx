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
import type { InventoryReportResponse } from "@/types";

export function InventoryReportTable() {
  const { formatMoney } = useAppCurrency();
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [data, setData] = useState<InventoryReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ from: fromDate, to: toDate });
    const res = await fetch(`/api/reports/inventory?${q}`);
    const j = await res.json();
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Report failed");
      setData(null);
      setLoading(false);
      return;
    }
    setData({
      snapshot: (j.snapshot ?? []) as InventoryReportResponse["snapshot"],
      movementTotals: j.movementTotals ?? {
        IN: 0,
        OUT: 0,
        ADJUSTMENT: 0,
      },
    });
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const totalUnits =
    data?.snapshot.reduce((s, r) => s + r.stock_on_hand, 0) ?? 0;
  const totalValue =
    data?.snapshot.reduce((s, r) => s + r.value, 0) ?? 0;
  const skusWithStock =
    data?.snapshot.filter((r) => r.stock_on_hand > 0).length ?? 0;

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Inventory valuation</CardTitle>
          <CardDescription>
            Current stock × weighted average cost per SKU. Movement counts below
            use the selected date range.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv-from">Movements from</Label>
              <Input
                id="inv-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv-to">Movements to</Label>
              <Input
                id="inv-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <Button type="button" onClick={() => void load()} disabled={loading}>
              {loading ? "Loading…" : "Refresh"}
            </Button>
          </div>

          {data ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs uppercase">
                  SKUs in catalog
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {data.snapshot.length}
                </p>
              </div>
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs uppercase">
                  SKUs with stock
                </p>
                <p className="text-lg font-semibold tabular-nums">{skusWithStock}</p>
              </div>
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs uppercase">
                  Units on hand
                </p>
                <p className="text-lg font-semibold tabular-nums">{totalUnits}</p>
              </div>
              <div className="bg-muted/50 rounded-lg border p-3">
                <p className="text-muted-foreground text-xs uppercase">
                  Stock value (WAC)
                </p>
                <p className="text-lg font-semibold tabular-nums">
                  {formatMoney(totalValue)}
                </p>
              </div>
            </div>
          ) : null}

          {data ? (
            <div>
              <h3 className="mb-2 text-sm font-medium">
                Movements in range (units)
              </h3>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="rounded-md border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">IN (receipts)</span>
                  <span className="float-right font-medium tabular-nums">
                    {data.movementTotals.IN}
                  </span>
                </div>
                <div className="rounded-md border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">OUT (sales)</span>
                  <span className="float-right font-medium tabular-nums">
                    {data.movementTotals.OUT}
                  </span>
                </div>
                <div className="rounded-md border px-3 py-2 text-sm">
                  <span className="text-muted-foreground">
                    ADJUSTMENT (net Δ)
                  </span>
                  <span className="float-right font-medium tabular-nums">
                    {data.movementTotals.ADJUSTMENT}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>SKU detail</CardTitle>
          <CardDescription>
            Sorted by inventory value (stock × average cost).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">SKU</th>
                  <th className="pb-2 text-right font-medium">On hand</th>
                  <th className="pb-2 text-right font-medium">Avg cost</th>
                  <th className="pb-2 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(data?.snapshot ?? []).map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 font-medium">{r.name}</td>
                    <td className="py-2 text-muted-foreground">{r.sku}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.stock_on_hand}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {formatMoney(r.avg_cost)}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatMoney(r.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data?.snapshot.length && !loading ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No products.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

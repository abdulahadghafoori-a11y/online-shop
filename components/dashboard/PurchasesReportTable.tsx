"use client";

import { Fragment, useEffect, useState } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronRight } from "lucide-react";
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
import type { PurchaseReportRow } from "@/types";
import { cn } from "@/lib/utils";

export function PurchasesReportTable() {
  const { formatMoney } = useAppCurrency();
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [rows, setRows] = useState<PurchaseReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggleExpanded(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function load() {
    setLoading(true);
    setError(null);
    const q = new URLSearchParams({ from: fromDate, to: toDate });
    const res = await fetch(`/api/reports/purchases?${q}`);
    const j = await res.json();
    if (!res.ok) {
      setError(typeof j.error === "string" ? j.error : "Report failed");
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((j.data ?? []) as PurchaseReportRow[]);
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
      pos: acc.pos + 1,
      lines: acc.lines + r.line_count,
      qty: acc.qty + r.total_qty,
      value: acc.value + r.total_value,
      base: acc.base + r.total_extended_base,
      ship: acc.ship + r.total_extended_shipping,
      pack: acc.pack + r.total_extended_packaging,
    }),
    {
      pos: 0,
      lines: 0,
      qty: 0,
      value: 0,
      base: 0,
      ship: 0,
      pack: 0,
    },
  );

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Purchase orders</CardTitle>
        <CardDescription>
          POs created in the range. Each row expands to line-level{" "}
          <strong className="font-medium text-foreground">base</strong>,{" "}
          <strong className="font-medium text-foreground">shipping</strong>, and{" "}
          <strong className="font-medium text-foreground">packaging</strong> per
          unit (book currency), plus stored{" "}
          <code className="text-xs">unit_cost</code> and extensions.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="po-from">From</Label>
            <Input
              id="po-from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="po-to">To</Label>
            <Input
              id="po-to"
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
          <div className="text-muted-foreground grid gap-2 text-xs sm:grid-cols-3 lg:grid-cols-7">
            <div>
              <span className="block uppercase">POs</span>
              <span className="font-medium text-foreground">{totals.pos}</span>
            </div>
            <div>
              <span className="block uppercase">Lines</span>
              <span className="font-medium text-foreground">{totals.lines}</span>
            </div>
            <div>
              <span className="block uppercase">Total qty</span>
              <span className="font-medium tabular-nums text-foreground">
                {totals.qty.toLocaleString()}
              </span>
            </div>
            <div>
              <span className="block uppercase">Ext. base</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.base)}
              </span>
            </div>
            <div>
              <span className="block uppercase">Ext. ship</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.ship)}
              </span>
            </div>
            <div>
              <span className="block uppercase">Ext. pack</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.pack)}
              </span>
            </div>
            <div>
              <span className="block uppercase">Ext. total</span>
              <span className="font-medium tabular-nums text-foreground">
                {formatMoney(totals.value)}
              </span>
            </div>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[76rem] text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                <th className="w-8 pb-2" aria-hidden />
                <th className="pb-2 font-medium">Created</th>
                <th className="pb-2 font-medium">Supplier</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 text-right font-medium">Lines</th>
                <th className="pb-2 text-right font-medium">Qty</th>
                <th className="pb-2 text-right font-medium">Ext. base</th>
                <th className="pb-2 text-right font-medium">Ext. ship</th>
                <th className="pb-2 text-right font-medium">Ext. pack</th>
                <th className="pb-2 text-right font-medium">Total</th>
                <th className="pb-2 font-medium">Received</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => {
                const isOpen = expanded.has(r.id);
                return (
                  <Fragment key={r.id}>
                    <tr className="align-top">
                      <td className="py-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          onClick={() => toggleExpanded(r.id)}
                          aria-expanded={isOpen}
                          aria-label={
                            isOpen ? "Hide line items" : "Show line items"
                          }
                        >
                          {isOpen ? (
                            <ChevronDown className="size-4" />
                          ) : (
                            <ChevronRight className="size-4" />
                          )}
                        </Button>
                      </td>
                      <td className="py-2 tabular-nums">
                        {new Date(r.created_at).toLocaleString(undefined, {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="py-2 font-medium">{r.supplier_name}</td>
                      <td className="py-2 capitalize">{r.status}</td>
                      <td className="py-2 text-right tabular-nums">
                        {r.line_count}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {r.total_qty.toLocaleString()}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatMoney(r.total_extended_base)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatMoney(r.total_extended_shipping)}
                      </td>
                      <td className="py-2 text-right tabular-nums">
                        {formatMoney(r.total_extended_packaging)}
                      </td>
                      <td className="py-2 text-right font-medium tabular-nums">
                        {formatMoney(r.total_value)}
                      </td>
                      <td className="py-2 text-muted-foreground tabular-nums">
                        {r.received_at
                          ? new Date(r.received_at).toLocaleString(undefined, {
                              dateStyle: "short",
                            })
                          : "—"}
                      </td>
                    </tr>
                    {isOpen ? (
                      <tr className="bg-muted/30">
                        <td colSpan={11} className="p-0">
                          <div className="px-4 py-3">
                            <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                              Line items
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground border-b text-left">
                                  <th className="pb-1.5 pr-3 font-medium">
                                    Product
                                  </th>
                                  <th className="pb-1.5 pr-3 font-medium">
                                    SKU
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Qty
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Base / u
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Ship / u
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Pack / u
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Landed / u
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Unit cost
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Ext. base
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Ext. ship
                                  </th>
                                  <th className="pb-1.5 pr-3 text-right font-medium">
                                    Ext. pack
                                  </th>
                                  <th className="pb-1.5 text-right font-medium">
                                    Line total
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border/60">
                                {r.lines.map((line, idx) => (
                                  <tr key={`${r.id}-${line.product_id}-${idx}`}>
                                    <td className="py-1.5 pr-3 font-medium">
                                      {line.product_name}
                                    </td>
                                    <td className="text-muted-foreground py-1.5 pr-3">
                                      {line.sku}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {line.quantity.toLocaleString()}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {formatMoney(line.base_cost)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {formatMoney(line.shipping_cost_per_unit)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {formatMoney(line.packaging_cost_per_unit)}
                                    </td>
                                    <td
                                      className={cn(
                                        "py-1.5 pr-3 text-right tabular-nums",
                                        Math.abs(line.landed_unit - line.unit_cost) >
                                          0.0005 &&
                                          "text-amber-700 dark:text-amber-400",
                                      )}
                                      title={
                                        Math.abs(
                                          line.landed_unit - line.unit_cost,
                                        ) > 0.0005
                                          ? "Sum of base+ship+pack differs from stored unit_cost"
                                          : undefined
                                      }
                                    >
                                      {formatMoney(line.landed_unit)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {formatMoney(line.unit_cost)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {formatMoney(line.extended_base)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {formatMoney(line.extended_shipping)}
                                    </td>
                                    <td className="py-1.5 pr-3 text-right tabular-nums">
                                      {formatMoney(line.extended_packaging)}
                                    </td>
                                    <td className="py-1.5 text-right font-medium tabular-nums">
                                      {formatMoney(line.extended_total)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          {!rows.length && !loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No purchase orders created in this range.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

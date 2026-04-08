"use client";

import { Fragment, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronDown, ChevronRight } from "lucide-react";
import { ReceiveButton, CancelPOButton } from "@/components/dashboard/PurchaseFormSection";
import { Button } from "@/components/ui/button";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";
import type { PurchaseReportRow } from "@/types";
import { cn } from "@/lib/utils";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function PurchaseOrdersTable({
  orders,
  currentStatus,
}: {
  orders: PurchaseReportRow[];
  currentStatus: string;
}) {
  const { formatMoney } = useAppCurrency();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const router = useRouter();
  const searchParams = useSearchParams();

  function setStatusFilter(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("status", value);
    else params.delete("status");
    router.push(`/dashboard/purchases${params.size ? `?${params}` : ""}`);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {STATUS_OPTIONS.map((opt) => (
          <Button
            key={opt.value}
            type="button"
            variant={currentStatus === opt.value ? "default" : "outline"}
            size="sm"
            onClick={() => setStatusFilter(opt.value)}
          >
            {opt.label}
          </Button>
        ))}
      </div>
      <div className="overflow-x-auto">
      <table className="w-full min-w-[64rem] text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="w-8 pb-2" aria-hidden />
            <th className="pb-2 pr-4 font-medium">Supplier</th>
            <th className="pb-2 pr-4 font-medium">Status</th>
            <th className="pb-2 pr-4 font-medium text-right">Lines</th>
            <th className="pb-2 pr-4 font-medium text-right">Ext. base</th>
            <th className="pb-2 pr-4 font-medium text-right">Ext. ship</th>
            <th className="pb-2 pr-4 font-medium text-right">Ext. pack</th>
            <th className="pb-2 pr-4 font-medium text-right">Total</th>
            <th className="pb-2 pr-4 font-medium">Created</th>
            <th className="pb-2 pr-4 font-medium">Received</th>
            <th className="pb-2 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {orders.map((po) => {
            const isOpen = expanded.has(po.id);
            return (
              <Fragment key={po.id}>
                <tr className="align-top">
                  <td className="py-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      onClick={() => toggle(po.id)}
                      aria-expanded={isOpen}
                      aria-label={
                        isOpen ? "Hide cost breakdown" : "Show cost breakdown"
                      }
                    >
                      {isOpen ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </Button>
                  </td>
                  <td className="py-2 pr-4 font-medium">
                    {po.supplier_name}
                  </td>
                  <td className="py-2 pr-4">
                    <span
                      className={
                        po.status === "received"
                          ? "inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                          : po.status === "cancelled"
                            ? "inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
                            : "inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                      }
                    >
                      {po.status}
                    </span>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {po.line_count}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatMoney(po.total_extended_base)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatMoney(po.total_extended_shipping)}
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    {formatMoney(po.total_extended_packaging)}
                  </td>
                  <td className="py-2 pr-4 text-right font-medium tabular-nums">
                    {formatMoney(po.total_value)}
                  </td>
                  <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap">
                    {new Date(po.created_at).toLocaleDateString()}
                  </td>
                  <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap">
                    {po.received_at
                      ? new Date(po.received_at).toLocaleDateString()
                      : "—"}
                  </td>
                  <td className="py-2 text-right">
                    {po.status === "draft" ? (
                      <div className="flex items-center justify-end gap-1">
                        <CancelPOButton poId={po.id} />
                        <ReceiveButton poId={po.id} />
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
                {isOpen ? (
                  <tr className="bg-muted/30">
                    <td colSpan={11} className="p-0">
                      <div className="px-4 py-3">
                        <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                          Line cost breakdown
                        </p>
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-muted-foreground border-b text-left">
                              <th className="pb-1.5 pr-3 font-medium">
                                Product
                              </th>
                              <th className="pb-1.5 pr-3 font-medium">SKU</th>
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
                            {po.lines.map((line, idx) => (
                              <tr key={`${po.id}-${line.product_id}-${idx}`}>
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
      {!orders.length ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
          No purchase orders match the current filter.
        </p>
      ) : null}
      </div>
    </div>
  );
}

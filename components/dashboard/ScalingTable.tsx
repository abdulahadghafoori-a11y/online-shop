"use client";

import { useEffect, useState } from "react";
import type { ScalingRow } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { scalingLabelBadgeClass } from "@/lib/scalingReport";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";

export function ScalingTable() {
  const { formatMoney } = useAppCurrency();
  const [rows, setRows] = useState<ScalingRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/reports/scaling")
      .then((r) => r.json())
      .then((d) => setRows(d.data ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Campaign decisions</CardTitle>
        <CardDescription>
          After daily stats are uploaded, each campaign is scored on the last{" "}
          7 days: delivery spend vs order revenue attributed to that campaign.
          SCALE / WATCH / KILL also appear on each campaign, ad set, and ad page.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground animate-pulse text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-muted-foreground text-sm">No campaign data yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                  <th className="pb-2 font-medium">Campaign</th>
                  <th className="pb-2 text-right font-medium">Spend</th>
                  <th className="pb-2 text-right font-medium">ROAS</th>
                  <th className="pb-2 text-right font-medium">Profit</th>
                  <th className="pb-2 text-center font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.campaignid}>
                    <td className="max-w-[140px] truncate py-2 font-medium">
                      {row.campaignname}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {formatMoney(row.spend)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-muted-foreground">
                      {row.roas.toFixed(2)}×
                    </td>
                    <td
                      className={cn(
                        "py-2 text-right font-semibold tabular-nums",
                        row.profit >= 0
                          ? "text-green-600 dark:text-green-500"
                          : "text-destructive"
                      )}
                    >
                      {formatMoney(row.profit)}
                    </td>
                    <td className="py-2 text-center">
                      <span className={scalingLabelBadgeClass(row.label)}>
                        {row.label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

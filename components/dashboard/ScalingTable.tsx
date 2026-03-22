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

const badge: Record<string, string> = {
  SCALE:
    "border-green-200 bg-green-100 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-400",
  WATCH:
    "border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200",
  KILL: "border-red-200 bg-red-100 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-400",
};

export function ScalingTable() {
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
        <CardDescription>Last 7 days — spend vs attributed revenue.</CardDescription>
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
                      ${row.spend.toFixed(0)}
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
                      ${row.profit.toFixed(0)}
                    </td>
                    <td className="py-2 text-center">
                      <span
                        className={cn(
                          "inline-block rounded-md border px-2 py-0.5 text-xs font-semibold",
                          badge[row.label]
                        )}
                      >
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

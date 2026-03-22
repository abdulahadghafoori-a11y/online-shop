"use client";

import { useEffect, useState } from "react";
import type { FunnelReport } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function FunnelWidget() {
  const [data, setData] = useState<FunnelReport | null>(null);

  useEffect(() => {
    fetch("/api/reports/funnel")
      .then((r) => r.json())
      .then((d) => setData(d.data ?? null));
  }, []);

  const max = data
    ? Math.max(data.clicks, data.leads, data.orders, 1)
    : 1;

  const steps = data
    ? [
        { label: "Clicks", value: data.clicks, width: (data.clicks / max) * 100 },
        { label: "Leads", value: data.leads, width: (data.leads / max) * 100 },
        {
          label: "Orders",
          value: data.orders,
          width: (data.orders / max) * 100,
        },
      ]
    : [];

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">Funnel</CardTitle>
        <CardDescription>All-time counts (excl. cancelled orders).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {steps.map((step) => (
            <div key={step.label} className="flex items-center gap-3">
              <div className="text-muted-foreground w-16 text-xs">{step.label}</div>
              <div className="bg-muted h-2 flex-1 overflow-hidden rounded-full">
                <div
                  className="bg-primary h-2 rounded-full transition-all"
                  style={{ width: `${Math.max(step.width, 4)}%` }}
                />
              </div>
              <div className="w-14 text-right text-sm font-medium tabular-nums">
                {step.value.toLocaleString()}
              </div>
            </div>
          ))}
          {data ? (
            <div className="text-muted-foreground grid grid-cols-3 gap-2 border-t pt-3 text-xs">
              <div>C→L {data.clicktolead}</div>
              <div>L→O {data.leadtoorder}</div>
              <div>C→O {data.clicktoorder}</div>
            </div>
          ) : (
            <p className="text-muted-foreground animate-pulse text-sm">Loading…</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

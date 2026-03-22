"use client";

import { useEffect, useState } from "react";
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

interface Row {
  campaignid: string;
  campaignname: string;
  spend: number;
  orders: number;
  revenue: number;
  profit: number;
  roas: number;
  cpa: number;
}

export function CampaignReportTable() {
  const to = new Date().toISOString().split("T")[0];
  const from = new Date(Date.now() - 30 * 864e5).toISOString().split("T")[0];
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    const q = new URLSearchParams({ from: fromDate, to: toDate });
    const res = await fetch(`/api/reports/campaign?${q}`);
    const j = await res.json();
    setRows(j.data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- initial load only
  }, []);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Campaign profit</CardTitle>
        <CardDescription>
          Pulls from <code className="text-xs">campaignprofitreport</code>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-2">
            <Label htmlFor="from">From</Label>
            <Input
              id="from"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to">To</Label>
            <Input
              id="to"
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
                <th className="pb-2 font-medium">Campaign</th>
                <th className="pb-2 text-right font-medium">Spend</th>
                <th className="pb-2 text-right font-medium">Revenue</th>
                <th className="pb-2 text-right font-medium">Profit</th>
                <th className="pb-2 text-right font-medium">Orders</th>
                <th className="pb-2 text-right font-medium">ROAS</th>
                <th className="pb-2 text-right font-medium">CPA</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.campaignid}>
                  <td className="py-2 font-medium">{r.campaignname}</td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(r.spend).toFixed(2)}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(r.revenue).toFixed(2)}
                  </td>
                  <td className="py-2 text-right font-medium tabular-nums">
                    ${Number(r.profit).toFixed(2)}
                  </td>
                  <td className="py-2 text-right tabular-nums">{r.orders}</td>
                  <td className="py-2 text-right tabular-nums">
                    {Number(r.roas).toFixed(2)}×
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    ${Number(r.cpa).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !loading ? (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No rows — add campaigns, orders, and daily ad stats.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

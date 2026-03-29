"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

type SyncResult = {
  action: string;
  ok: boolean;
  count?: number;
  error?: string;
};

const ACTIONS = [
  {
    id: "campaigns",
    label: "Campaigns",
    description: "Fetch all campaigns from Meta and upsert into local DB",
  },
  {
    id: "adsets",
    label: "Ad Sets",
    description: "Fetch ad sets (requires campaigns synced first)",
  },
  {
    id: "ads",
    label: "Ads",
    description: "Fetch ads (requires ad sets synced first)",
  },
  {
    id: "insights_today",
    label: "Today's spend",
    description: "Spend, clicks, impressions for today",
  },
  {
    id: "insights_7d",
    label: "Last 7 days spend",
    description: "Spend, clicks, impressions for the past 7 days",
  },
  {
    id: "all",
    label: "Full sync",
    description:
      "Campaigns → Ad Sets → Ads → 7-day insights in sequence",
  },
] as const;

export function MetaSyncPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [results, setResults] = useState<SyncResult[]>([]);

  async function runSync(action: string) {
    setLoading(action);
    setResults([]);
    try {
      const res = await fetch("/api/meta/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ action }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        results?: SyncResult[];
        error?: string;
      };
      const list = (json.results ?? []) as SyncResult[];
      setResults(list);
      if (!res.ok && list.length === 0) {
        toast.error(
          typeof json.error === "string" ? json.error : "Meta sync failed",
        );
        return;
      }
      for (const r of list) {
        if (r.ok) {
          toast.success(`${r.action}: ${r.count ?? 0} rows synced`);
        } else {
          toast.error(r.error ?? `${r.action} failed`);
        }
      }
    } catch {
      setResults([{ action, ok: false, error: "Network error" }]);
      toast.error("Meta sync failed: network error");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>Sync from Meta Ads</CardTitle>
        <CardDescription>
          Pull campaigns, ad sets, ads, and daily spend from the Meta Marketing
          API into your local Supabase tables. Sync is idempotent (upsert).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {ACTIONS.map((a) => (
            <Button
              key={a.id}
              type="button"
              variant={a.id === "all" ? "default" : "outline"}
              size="sm"
              disabled={loading !== null}
              onClick={() => void runSync(a.id)}
              title={a.description}
            >
              {loading === a.id ? (
                <RefreshCw className="size-3.5 animate-spin" />
              ) : null}
              {a.label}
            </Button>
          ))}
        </div>

        {results.length > 0 ? (
          <div className="space-y-2">
            {results.map((r, i) => (
              <div
                key={i}
                className={
                  r.ok
                    ? "rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200"
                    : "rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive"
                }
              >
                <strong className="font-medium">{r.action}</strong>
                {r.ok
                  ? ` — ${r.count ?? 0} rows synced`
                  : ` — ${r.error ?? "failed"}`}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

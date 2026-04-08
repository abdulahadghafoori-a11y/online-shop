import { NextRequest, NextResponse } from "next/server";
import { requireAdminApiUser } from "@/lib/authApi";
import {
  syncCampaignsToSupabase,
  syncAdSetsToSupabase,
  syncAdsToSupabase,
  syncInsightsToSupabase,
  type SyncResult,
} from "@/lib/metaMarketing";

const VALID_ACTIONS = [
  "campaigns",
  "adsets",
  "ads",
  "insights_today",
  "insights_7d",
  "all",
] as const;

type Action = (typeof VALID_ACTIONS)[number];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoISO(n: number) {
  return new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
}

export async function POST(req: NextRequest) {
  const gate = await requireAdminApiUser();
  if (!gate.ok) {
    return NextResponse.json({ error: gate.message }, { status: gate.status });
  }

  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
  };

  const action = body.action as Action;
  if (!action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json(
      {
        error: `Invalid action. Use one of: ${VALID_ACTIONS.join(", ")}`,
      },
      { status: 400 }
    );
  }

  const results: SyncResult[] = [];

  try {
    if (action === "campaigns" || action === "all") {
      results.push(await syncCampaignsToSupabase());
    }

    if (action === "adsets" || action === "all") {
      results.push(await syncAdSetsToSupabase());
    }

    if (action === "ads" || action === "all") {
      results.push(await syncAdsToSupabase());
    }

    if (action === "insights_today" || action === "all") {
      const today = todayISO();
      results.push(await syncInsightsToSupabase(today, today));
    }

    if (action === "insights_7d" || action === "all") {
      results.push(
        await syncInsightsToSupabase(daysAgoISO(7), todayISO())
      );
    }

    const anyFailed = results.some((r) => !r.ok);
    return NextResponse.json(
      { results },
      { status: anyFailed ? 207 : 200 }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}

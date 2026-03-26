import { createClient } from "@/lib/supabaseServer";
import { fetchMetaAdAccountCampaigns } from "@/lib/metaMarketing";
import { MetaSyncPanel } from "@/components/dashboard/MetaSyncPanel";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const [metaResult, { data: localCampaigns }] = await Promise.all([
    fetchMetaAdAccountCampaigns(),
    supabase
      .from("campaigns")
      .select("id, name, platform, status, metacampaignid, createdat")
      .order("createdat", { ascending: false }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground text-sm">
          Sync campaigns from Meta Ads, then use local UUIDs in tracking links:{" "}
          <code className="text-xs">
            /w?campaignid=…&amp;adsetid=…&amp;adid=…
          </code>
        </p>
      </div>

      <MetaSyncPanel />

      <Card>
        <CardHeader>
          <CardTitle>Local campaigns (Supabase)</CardTitle>
          <CardDescription>
            After syncing, these rows power attribution and reports. The Meta ID
            column links to the original Meta campaign.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Platform</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Meta ID</th>
                  <th className="pb-2 font-medium">Local ID</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(localCampaigns ?? []).map((c) => (
                  <tr key={c.id} className="text-foreground">
                    <td className="py-2 pr-4 text-sm">{c.name}</td>
                    <td className="py-2 pr-4 capitalize">{c.platform}</td>
                    <td className="py-2 pr-4 capitalize">{c.status}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                      {c.metacampaignid ?? "—"}
                    </td>
                    <td className="py-2 break-all font-mono text-xs text-muted-foreground">
                      {c.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!localCampaigns?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No campaigns yet — click <strong>Full sync</strong> above to
                pull from Meta.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Live Meta Ads campaigns</CardTitle>
          <CardDescription
            className={metaResult.ok ? undefined : "text-muted-foreground"}
          >
            {metaResult.ok ? (
              <>
                Pulled directly from the Marketing API (
                <code className="text-xs">ads_read</code>). This read-through
                call refreshes every page load (no cache).
              </>
            ) : (
              metaResult.error
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!metaResult.ok && metaResult.errorCode === "missing_config" ? (
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-xs">
              <li>
                <strong className="text-foreground">META_AD_ACCOUNT_ID</strong>{" "}
                — numeric id from Ads Manager → Settings (with or without{" "}
                <span className="font-mono">act_</span> prefix).
              </li>
              <li>
                <strong className="text-foreground">
                  META_MARKETING_ACCESS_TOKEN
                </strong>{" "}
                — user or system user token with{" "}
                <span className="font-mono">ads_read</span>.
              </li>
            </ul>
          ) : null}

          {metaResult.ok ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Meta ID</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Effective</th>
                    <th className="pb-2 pr-4 font-medium">Objective</th>
                    <th className="pb-2 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y font-mono text-xs">
                  {metaResult.data.map((c) => (
                    <tr key={c.id} className="text-foreground">
                      <td className="max-w-[200px] py-2 pr-4 font-sans text-sm">
                        <span className="line-clamp-2" title={c.name}>
                          {c.name}
                        </span>
                      </td>
                      <td className="py-2 pr-4 break-all text-muted-foreground">
                        {c.id}
                      </td>
                      <td className="py-2 pr-4 font-sans text-xs capitalize">
                        {c.status?.toLowerCase() ?? "—"}
                      </td>
                      <td className="py-2 pr-4 font-sans text-xs capitalize">
                        {(c.effective_status ?? "—")
                          .toLowerCase()
                          .replace(/_/g, " ")}
                      </td>
                      <td className="py-2 pr-4 font-sans text-xs text-muted-foreground">
                        {c.objective ?? "—"}
                      </td>
                      <td className="py-2 font-sans text-xs whitespace-nowrap text-muted-foreground">
                        {c.created_time
                          ? new Date(c.created_time).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!metaResult.data.length ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No campaigns returned — create some in Ads Manager or check
                  token access.
                </p>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

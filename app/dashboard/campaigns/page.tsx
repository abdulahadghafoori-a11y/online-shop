import { createClient } from "@/lib/supabaseServer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function CampaignsPage() {
  const supabase = await createClient();
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("id, name, platform, status, createdat")
    .order("createdat", { ascending: false });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Campaigns</h1>
        <p className="text-muted-foreground text-sm">
          Use these IDs in ad URLs:{" "}
          <code className="text-xs">/w?campaignid=…&amp;adsetid=…&amp;adid=…</code>
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All campaigns</CardTitle>
          <CardDescription>Synced spend lives in daily ad stats.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">Platform</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">ID</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono text-xs">
                {(campaigns ?? []).map((c) => (
                  <tr key={c.id} className="text-foreground">
                    <td className="py-2 pr-4 font-sans text-sm">{c.name}</td>
                    <td className="py-2 pr-4 font-sans capitalize">
                      {c.platform}
                    </td>
                    <td className="py-2 pr-4 font-sans capitalize">
                      {c.status}
                    </td>
                    <td className="py-2 break-all text-muted-foreground">
                      {c.id}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!campaigns?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No campaigns yet.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { createClient } from "@/lib/supabaseServer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function LeadsPage() {
  const supabase = await createClient();

  const { data: leads, count } = await supabase
    .from("leads")
    .select(
      `id, phone, createdat, clickid,
       adid,
       ads ( name, adsets ( name, campaigns ( name ) ) )`,
      { count: "exact" },
    )
    .order("createdat", { ascending: false })
    .limit(100);

  const leadIds = (leads ?? []).map((l) => l.phone).filter(Boolean);
  const { data: conversions } = leadIds.length
    ? await supabase
        .from("orders")
        .select("phone")
        .in("phone", leadIds as string[])
        .neq("status", "cancelled")
    : { data: [] };

  const convertedPhones = new Set(
    (conversions ?? []).map((c) => c.phone),
  );

  type AdJoin = {
    name: string;
    adsets:
      | { name: string; campaigns: { name: string } | { name: string }[] | null }
      | { name: string; campaigns: { name: string } | { name: string }[] | null }[]
      | null;
  };

  function adLabel(ad: AdJoin | AdJoin[] | null): string {
    const a = Array.isArray(ad) ? ad[0] : ad;
    if (!a) return "—";
    const adset = Array.isArray(a.adsets) ? a.adsets[0] : a.adsets;
    if (!adset) return a.name;
    const camp = Array.isArray(adset.campaigns) ? adset.campaigns[0] : adset.campaigns;
    return [camp?.name, adset.name, a.name].filter(Boolean).join(" › ");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Leads</h1>
        <p className="text-muted-foreground text-sm">
          {count ?? 0} leads captured from WhatsApp click tracking.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Total leads
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">{count ?? 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Converted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums text-green-600 dark:text-green-500">
              {convertedPhones.size}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
              Conversion rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold tabular-nums">
              {(count ?? 0) > 0
                ? `${((convertedPhones.size / (count ?? 1)) * 100).toFixed(1)}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent leads</CardTitle>
          <CardDescription>
            Latest 100 leads. Green badge = has at least one non-cancelled order.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 pr-4 font-medium">Phone</th>
                  <th className="pb-2 pr-4 font-medium">Click ID</th>
                  <th className="pb-2 pr-4 font-medium">Ad source</th>
                  <th className="pb-2 font-medium">Converted</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(leads ?? []).map((l) => {
                  const converted = l.phone ? convertedPhones.has(l.phone) : false;
                  return (
                    <tr key={l.id}>
                      <td className="py-2 pr-4 whitespace-nowrap text-muted-foreground">
                        {new Date(l.createdat).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {l.phone ?? "—"}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                        {l.clickid ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-xs text-muted-foreground">
                        {adLabel(l.ads as AdJoin | AdJoin[] | null)}
                      </td>
                      <td className="py-2">
                        {converted ? (
                          <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                            Yes
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!leads?.length && (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No leads yet. Leads are created when users click your /w tracking link.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

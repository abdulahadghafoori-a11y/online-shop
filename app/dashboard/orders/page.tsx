import Link from "next/link";
import { createClient } from "@/lib/supabaseServer";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OrdersPage() {
  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select(
      "id, phone, status, createdat, confidencescore, attributionmethod, campaignid"
    )
    .order("createdat", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Orders</h1>
          <p className="text-muted-foreground text-sm">
            Recent orders (latest 50).
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/orders/new">New order</Link>
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All orders</CardTitle>
          <CardDescription>Attribution and status at a glance.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 pr-4 font-medium">Phone</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium">Method</th>
                  <th className="pb-2 font-medium text-right">Confidence</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(orders ?? []).map((o) => (
                  <tr key={o.id} className="text-foreground">
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(o.createdat).toLocaleString()}
                    </td>
                    <td className="py-2 pr-4">{o.phone}</td>
                    <td className="py-2 pr-4 capitalize">{o.status}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {o.attributionmethod ?? "—"}
                    </td>
                    <td className="py-2 text-right">
                      {o.confidencescore != null
                        ? Number(o.confidencescore).toFixed(2)
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No orders yet. Create one to get started.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

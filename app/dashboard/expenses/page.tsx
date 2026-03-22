import { createClient } from "@/lib/supabaseServer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ExpensesPage() {
  const supabase = await createClient();
  const { data: expenses } = await supabase
    .from("expenses")
    .select("id, category, amount, date, notes")
    .order("date", { ascending: false })
    .limit(100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground text-sm">
          Operational costs (separate from ad spend in{" "}
          <code className="text-xs">dailyadstats</code>).
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Recent expenses</CardTitle>
          <CardDescription>Latest 100 rows.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Category</th>
                  <th className="pb-2 pr-4 font-medium">Notes</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(expenses ?? []).map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-4 whitespace-nowrap">{e.date}</td>
                    <td className="py-2 pr-4">{e.category}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {e.notes ?? "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      ${Number(e.amount).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!expenses?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No expenses recorded.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

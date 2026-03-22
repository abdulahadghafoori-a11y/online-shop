import { createClient } from "@/lib/supabaseServer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function ProductsPage() {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("inventorybalance")
    .select("productid, productname, sku, stockonhand")
    .order("productname");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Products</h1>
        <p className="text-muted-foreground text-sm">
          Catalog and on-hand stock from inventory transactions.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Inventory</CardTitle>
          <CardDescription>
            Stock is derived from the{" "}
            <code className="text-xs">inventorybalance</code> view.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Name</th>
                  <th className="pb-2 pr-4 font-medium">SKU</th>
                  <th className="pb-2 font-medium text-right">On hand</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(rows ?? []).map((r) => (
                  <tr key={r.productid}>
                    <td className="py-2 pr-4">{r.productname}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.sku}</td>
                    <td className="py-2 text-right tabular-nums">
                      {r.stockonhand}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No products yet. Add rows in Supabase for{" "}
                <code className="text-xs">products</code>.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

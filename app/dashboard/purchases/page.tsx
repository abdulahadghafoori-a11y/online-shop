import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getCachedUsdAfnRate } from "@/lib/exchangeRates";
import { formatDbMoney } from "@/lib/formatDbMoney";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PurchaseFormSection } from "@/components/dashboard/PurchaseFormSection";

export default async function PurchasesPage() {
  const supabase = await createClient();
  const [displayCurrency, fx] = await Promise.all([
    getAppCurrency(),
    getCachedUsdAfnRate(),
  ]);
  const base = getAmountBaseCurrency();
  const money = (n: number) => formatDbMoney(n, displayCurrency, base, fx.afnPerUsd);

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select(
      "id, supplier_name, status, created_at, received_at, purchase_order_items(product_id, quantity, unit_cost, products(name))"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku")
    .eq("isactive", true)
    .order("name");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Purchases</h1>
        <p className="text-muted-foreground text-sm">
          Create purchase orders, then mark as received to update stock.
        </p>
      </div>

      <PurchaseFormSection products={products ?? []} />

      <Card>
        <CardHeader>
          <CardTitle>Purchase orders</CardTitle>
          <CardDescription>Most recent 50 purchase orders.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Supplier</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 pr-4 font-medium text-right">Items</th>
                  <th className="pb-2 pr-4 font-medium text-right">Total</th>
                  <th className="pb-2 pr-4 font-medium">Created</th>
                  <th className="pb-2 font-medium">Received</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(orders ?? []).map((po) => {
                  type POI = {
                    product_id: string;
                    quantity: number;
                    unit_cost: number;
                    products: { name: string } | { name: string }[] | null;
                  };
                  const items = (po.purchase_order_items ?? []) as POI[];
                  const total = items.reduce(
                    (s, i) => s + i.quantity * i.unit_cost,
                    0
                  );
                  return (
                    <tr key={po.id}>
                      <td className="py-2 pr-4 font-medium">
                        {po.supplier_name}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={
                            po.status === "received"
                              ? "inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400"
                              : po.status === "cancelled"
                                ? "inline-flex rounded-full bg-destructive/15 px-2 py-0.5 text-xs font-medium text-destructive"
                                : "inline-flex rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400"
                          }
                        >
                          {po.status}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {items.length}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {money(total)}
                      </td>
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(po.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-2 text-muted-foreground whitespace-nowrap">
                        {po.received_at
                          ? new Date(po.received_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!orders?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No purchase orders yet.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

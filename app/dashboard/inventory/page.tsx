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
import { StockAdjustmentForm } from "@/components/dashboard/StockAdjustmentForm";

export default async function InventoryPage() {
  const supabase = await createClient();
  const [displayCurrency, fx] = await Promise.all([
    getAppCurrency(),
    getCachedUsdAfnRate(),
  ]);
  const base = getAmountBaseCurrency();
  const money = (n: number) =>
    formatDbMoney(n, displayCurrency, base, fx.afnPerUsd);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, isactive")
    .order("name");

  const { data: balances } = await supabase
    .from("inventorybalance")
    .select("productid, stockonhand");

  const { data: costs } = await supabase
    .from("productcosts")
    .select("productid, unitcost, createdat")
    .order("createdat", { ascending: false });

  const balanceMap = new Map(
    (balances ?? []).map((b) => [b.productid, Number(b.stockonhand)])
  );

  const costMap = new Map<string, number>();
  for (const c of costs ?? []) {
    if (!costMap.has(c.productid)) {
      costMap.set(c.productid, Number(c.unitcost));
    }
  }

  const rows = (products ?? []).map((p) => ({
    ...p,
    stock: balanceMap.get(p.id) ?? 0,
    unitcost: costMap.get(p.id) ?? null,
    stockvalue:
      (balanceMap.get(p.id) ?? 0) * (costMap.get(p.id) ?? 0),
  }));

  const totalValue = rows.reduce((s, r) => s + r.stockvalue, 0);

  const { data: ledger } = await supabase
    .from("inventorytransactions")
    .select("id, productid, type, quantity, unitcost, createdat, products(name)")
    .order("createdat", { ascending: false })
    .limit(100);

  const { data: adjustments } = await supabase
    .from("stock_adjustments")
    .select("id, product_id, quantity, reason, created_at, products(name)")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground text-sm">
          Stock levels, valuation, and adjustment history.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total SKUs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total units on hand</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {rows.reduce((s, r) => s + r.stock, 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inventory value</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold tabular-nums">
              {money(totalValue)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock summary</CardTitle>
          <CardDescription>Current stock by product.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Product</th>
                  <th className="pb-2 pr-4 font-medium">SKU</th>
                  <th className="pb-2 pr-4 font-medium text-right">On hand</th>
                  <th className="pb-2 pr-4 font-medium text-right">
                    Unit cost
                  </th>
                  <th className="pb-2 font-medium text-right">Stock value</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2 pr-4 font-medium">{r.name}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.sku}</td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {r.stock}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums text-muted-foreground">
                      {r.unitcost != null ? money(r.unitcost) : "—"}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {money(r.stockvalue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!rows.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No products yet.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <StockAdjustmentForm
        products={(products ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          sku: p.sku,
        }))}
      />

      <Card>
        <CardHeader>
          <CardTitle>Transaction ledger</CardTitle>
          <CardDescription>
            Last 100 inventory movements (purchases, sales, adjustments).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Product</th>
                  <th className="pb-2 pr-4 font-medium">Type</th>
                  <th className="pb-2 pr-4 font-medium text-right">Qty</th>
                  <th className="pb-2 font-medium text-right">Unit cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(ledger ?? []).map((tx) => {
                  const productRaw = tx.products as
                    | { name: string }
                    | { name: string }[]
                    | null;
                  const product = Array.isArray(productRaw)
                    ? productRaw[0]
                    : productRaw;
                  return (
                    <tr key={tx.id}>
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(tx.createdat).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        {product?.name ?? "—"}
                      </td>
                      <td className="py-2 pr-4 capitalize">{tx.type}</td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {Number(tx.quantity) > 0 ? "+" : ""}
                        {tx.quantity}
                      </td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">
                        {tx.unitcost != null ? money(Number(tx.unitcost)) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!ledger?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No transactions yet.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Stock adjustments</CardTitle>
          <CardDescription>Last 50 manual adjustments.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">Date</th>
                  <th className="pb-2 pr-4 font-medium">Product</th>
                  <th className="pb-2 pr-4 font-medium text-right">Qty</th>
                  <th className="pb-2 font-medium">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {(adjustments ?? []).map((a) => {
                  const productRaw = a.products as
                    | { name: string }
                    | { name: string }[]
                    | null;
                  const product = Array.isArray(productRaw)
                    ? productRaw[0]
                    : productRaw;
                  return (
                    <tr key={a.id}>
                      <td className="py-2 pr-4 text-muted-foreground whitespace-nowrap">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 font-medium">
                        {product?.name ?? "—"}
                      </td>
                      <td className="py-2 pr-4 text-right tabular-nums">
                        {a.quantity > 0 ? "+" : ""}
                        {a.quantity}
                      </td>
                      <td className="py-2 text-muted-foreground">
                        {a.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!adjustments?.length ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No adjustments yet.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

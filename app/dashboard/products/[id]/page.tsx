import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabaseServer";
import { getAppCurrency } from "@/lib/appCurrencyServer";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";
import { formatDbMoney } from "@/lib/formatDbMoney";
import { ReceiveStockForm } from "@/components/dashboard/ReceiveStockForm";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type PageProps = { params: Promise<{ id: string }> };

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const [displayCurrency, fx] = await Promise.all([
    getAppCurrency(),
    getFxSnapshotForRequest(),
  ]);
  const base = getAmountBaseCurrency();
  const money = (n: number) =>
    formatDbMoney(n, displayCurrency, base, fx);

  const { data: product } = await supabase
    .from("products")
    .select(
      "id, name, sku, defaultsaleprice, isactive, stock_on_hand, avg_cost"
    )
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const stock = Number(product.stock_on_hand ?? 0);
  const avg = Number(product.avg_cost ?? 0);
  const invValue = stock * avg;

  const { data: receipts } = await supabase
    .from("stock_receipts")
    .select(
      "id, qty_received, unit_cost, base_cost, shipping_cost_per_unit, packaging_cost_per_unit, total_cost, received_date, notes, created_at"
    )
    .eq("product_id", id)
    .order("received_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  const { data: movements } = await supabase
    .from("inventory_movements")
    .select(
      "id, movement_type, qty, unit_cost_snapshot, reference_type, created_at"
    )
    .eq("product_id", id)
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/dashboard/products"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            ← Products
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="text-muted-foreground font-mono text-sm">{product.sku}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Inventory summary</CardTitle>
            <CardDescription>
              Moving weighted average cost updates only when stock is received.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Stock on hand</span>
              <span className="tabular-nums font-medium">{stock}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Avg cost (WAC)</span>
              <span className="tabular-nums font-medium">{money(avg)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Inventory value</span>
              <span className="tabular-nums font-medium">{money(invValue)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">List price</span>
              <span className="tabular-nums font-medium">
                {money(Number(product.defaultsaleprice))}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <span>
                {product.isactive !== false ? (
                  <span className="inline-flex rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                    Active
                  </span>
                ) : (
                  <span className="text-muted-foreground text-xs">Inactive</span>
                )}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receive stock</CardTitle>
            <CardDescription>
              Record actual base, shipping, and packaging per unit (rolled into
              WAC). Same breakdown is captured on purchase order lines.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ReceiveStockForm productId={id} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Stock receipts</CardTitle>
          <CardDescription>Historical inbound costing for this SKU.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            {(receipts ?? []).length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">Date</th>
                    <th className="p-3 text-right font-medium">Qty</th>
                    <th className="p-3 text-right font-medium">Base</th>
                    <th className="p-3 text-right font-medium">Ship</th>
                    <th className="p-3 text-right font-medium">Pack</th>
                    <th className="p-3 text-right font-medium">Unit Σ</th>
                    <th className="p-3 text-right font-medium">Total</th>
                    <th className="p-3 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(receipts ?? []).map((r) => (
                    <tr key={r.id}>
                      <td className="p-3 whitespace-nowrap">
                        {String(r.received_date)}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {r.qty_received}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {money(Number(r.base_cost ?? 0))}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {money(Number(r.shipping_cost_per_unit ?? 0))}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {money(Number(r.packaging_cost_per_unit ?? 0))}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {money(Number(r.unit_cost))}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {money(Number(r.total_cost))}
                      </td>
                      <td className="text-muted-foreground max-w-[200px] truncate p-3">
                        {r.notes ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground p-6 text-center text-sm">
                No receipts yet. Use Receive stock to add inventory.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent movements</CardTitle>
          <CardDescription>IN, OUT, and adjustments for this product.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            {(movements ?? []).length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="p-3 font-medium">When</th>
                    <th className="p-3 font-medium">Type</th>
                    <th className="p-3 text-right font-medium">Qty</th>
                    <th className="p-3 text-right font-medium">Unit cost</th>
                    <th className="p-3 font-medium">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(movements ?? []).map((m) => (
                    <tr key={m.id}>
                      <td className="p-3 whitespace-nowrap text-muted-foreground">
                        {new Date(m.created_at).toLocaleString()}
                      </td>
                      <td className="p-3">{m.movement_type}</td>
                      <td className="p-3 text-right tabular-nums">
                        {m.qty > 0 ? "+" : ""}
                        {m.qty}
                      </td>
                      <td className="p-3 text-right tabular-nums">
                        {m.unit_cost_snapshot != null
                          ? money(Number(m.unit_cost_snapshot))
                          : "—"}
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">
                        {m.reference_type ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted-foreground p-6 text-center text-sm">
                No movements recorded yet.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

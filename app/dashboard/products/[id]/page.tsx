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
import { AlertTriangle } from "lucide-react";

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
      "id, name, sku, defaultsaleprice, isactive, stock_on_hand, avg_cost, description, image_url, reorder_point"
    )
    .eq("id", id)
    .maybeSingle();

  if (!product) notFound();

  const stock = Number(product.stock_on_hand ?? 0);
  const avg = Number(product.avg_cost ?? 0);
  const invValue = stock * avg;
  const reorderPoint = Number(product.reorder_point ?? 0);
  const isLowStock = reorderPoint > 0 && stock <= reorderPoint;

  const thirtyDaysAgo = new Date(Date.now() - 30 * 864e5).toISOString();

  const [{ data: receipts }, { data: movements }, { data: salesData }, { data: recentSalesData }] =
    await Promise.all([
      supabase
        .from("stock_receipts")
        .select(
          "id, qty_received, unit_cost, base_cost, shipping_cost_per_unit, packaging_cost_per_unit, total_cost, received_date, notes, created_at"
        )
        .eq("product_id", id)
        .order("received_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("inventory_movements")
        .select(
          "id, movement_type, qty, unit_cost_snapshot, reference_type, created_at"
        )
        .eq("product_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("orderitems")
        .select("quantity, saleprice, product_cost_snapshot, orders!inner(status)")
        .eq("productid", id)
        .neq("orders.status", "cancelled"),
      supabase
        .from("orderitems")
        .select("quantity, saleprice, product_cost_snapshot, orders!inner(status, createdat)")
        .eq("productid", id)
        .neq("orders.status", "cancelled")
        .gte("orders.createdat", thirtyDaysAgo),
    ]);

  function computeSales(items: typeof salesData) {
    let units = 0;
    let revenue = 0;
    let cogs = 0;
    for (const item of items ?? []) {
      const qty = Number(item.quantity);
      units += qty;
      revenue += Number(item.saleprice) * qty;
      cogs += Number(item.product_cost_snapshot ?? 0) * qty;
    }
    return { units, revenue, profit: revenue - cogs };
  }

  const allTime = computeSales(salesData);
  const last30 = computeSales(recentSalesData);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link
            href="/dashboard/products"
            className="text-muted-foreground hover:text-foreground text-sm"
          >
            &larr; Products
          </Link>
          <h1 className="mt-2 text-xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="text-muted-foreground font-mono text-sm">{product.sku}</p>
          {product.description ? (
            <p className="text-muted-foreground mt-1 max-w-xl text-sm">
              {product.description}
            </p>
          ) : null}
        </div>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className="size-24 rounded-lg border object-cover"
          />
        ) : null}
      </div>

      {isLowStock && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          <AlertTriangle className="size-4 shrink-0" />
          <span>
            Stock is at or below reorder point ({reorderPoint}). Consider
            restocking.
          </span>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>All-time sales</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Units sold</span>
              <span className="tabular-nums font-medium">{allTime.units}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revenue</span>
              <span className="tabular-nums font-medium">{money(allTime.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profit</span>
              <span className="tabular-nums font-medium">{money(allTime.profit)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Last 30 days</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Units sold</span>
              <span className="tabular-nums font-medium">{last30.units}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Revenue</span>
              <span className="tabular-nums font-medium">{money(last30.revenue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Profit</span>
              <span className="tabular-nums font-medium">{money(last30.profit)}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Inventory</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">On hand</span>
              <span className="tabular-nums font-medium">{stock}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">WAC</span>
              <span className="tabular-nums font-medium">{money(avg)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Value</span>
              <span className="tabular-nums font-medium">{money(invValue)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">List price</span>
              <span className="tabular-nums font-medium">
                {money(Number(product.defaultsaleprice))}
              </span>
            </div>
            {reorderPoint > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Reorder at</span>
                <span className="tabular-nums font-medium">{reorderPoint}</span>
              </div>
            )}
            <div className="flex justify-between">
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
      </div>

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
                    <th className="p-3 text-right font-medium">Unit cost</th>
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
                        {r.notes ?? "\u2014"}
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
                          : "\u2014"}
                      </td>
                      <td className="text-muted-foreground p-3 text-xs">
                        {m.reference_type ?? "\u2014"}
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

import { createClient } from "@/lib/supabaseServer";
import {
  mapPurchaseOrderItemToLine,
  summarizePurchaseLines,
  type RawPurchaseOrderItem,
} from "@/lib/purchaseOrderLines";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PurchaseFormSection,
} from "@/components/dashboard/PurchaseFormSection";
import { PurchaseOrdersTable } from "@/components/dashboard/PurchaseOrdersTable";
import type { PurchaseReportRow } from "@/types";

export default async function PurchasesPage() {
  const supabase = await createClient();

  const { data: orders } = await supabase
    .from("purchase_orders")
    .select(
      `id, supplier_name, status, created_at, received_at,
      purchase_order_items (
        product_id,
        quantity,
        unit_cost,
        base_cost,
        shipping_cost_per_unit,
        packaging_cost_per_unit,
        products ( name, sku )
      )`,
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku")
    .eq("isactive", true)
    .order("name");

  const purchaseRows: PurchaseReportRow[] = (orders ?? []).map((po) => {
    const rawItems = (po.purchase_order_items ?? []) as RawPurchaseOrderItem[];
    const lines = rawItems.map(mapPurchaseOrderItemToLine);
    const sums = summarizePurchaseLines(lines);
    return {
      id: po.id as string,
      supplier_name: po.supplier_name as string,
      status: po.status as string,
      created_at: po.created_at as string,
      received_at: (po.received_at as string | null) ?? null,
      line_count: lines.length,
      lines,
      ...sums,
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Purchases</h1>
        <p className="text-muted-foreground text-sm">
          Enter actual base, shipping, and packaging per unit on each line.
          Receiving posts them into WAC. Use the chevron on each PO to see the
          full per-line breakdown.
        </p>
      </div>

      <PurchaseFormSection products={products ?? []} />

      <Card>
        <CardHeader>
          <CardTitle>Purchase orders</CardTitle>
          <CardDescription>
            Most recent 50 purchase orders. Extended columns are qty × component
            (book currency).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PurchaseOrdersTable orders={purchaseRows} />
        </CardContent>
      </Card>
    </div>
  );
}

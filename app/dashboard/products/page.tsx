import { createClient } from "@/lib/supabaseServer";
import {
  ProductSection,
  type ProductCatalogRow,
} from "@/components/dashboard/ProductSection";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: soldData }] = await Promise.all([
    supabase
      .from("products")
      .select(
        "id, name, sku, defaultsaleprice, isactive, stock_on_hand, avg_cost, wa_message, description, image_url, reorder_point"
      )
      .order("name"),
    supabase
      .from("orderitems")
      .select("productid, quantity, orders!inner(status)")
      .neq("orders.status", "cancelled"),
  ]);

  const soldMap = new Map<string, number>();
  for (const item of soldData ?? []) {
    const pid = item.productid as string;
    soldMap.set(pid, (soldMap.get(pid) ?? 0) + Number(item.quantity));
  }

  const rows: ProductCatalogRow[] = (products ?? []).map((p) => {
    const stock = Number(p.stock_on_hand ?? 0);
    const avg = Number(p.avg_cost ?? 0);
    return {
      id: p.id,
      name: p.name,
      sku: p.sku,
      defaultsaleprice: Number(p.defaultsaleprice),
      isactive: p.isactive !== false,
      stockonhand: stock,
      avgcost: avg,
      inventoryvalue: stock * avg,
      wa_message: p.wa_message ?? null,
      description: p.description ?? null,
      image_url: p.image_url ?? null,
      reorder_point: Number(p.reorder_point ?? 0),
      unitssold: soldMap.get(p.id) ?? 0,
    };
  });

  return <ProductSection rows={rows} />;
}

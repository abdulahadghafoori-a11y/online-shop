import { createClient } from "@/lib/supabaseServer";
import {
  ProductSection,
  type ProductCatalogRow,
} from "@/components/dashboard/ProductSection";

export default async function ProductsPage() {
  const supabase = await createClient();

  const { data: products } = await supabase
    .from("products")
    .select(
      "id, name, sku, defaultsaleprice, isactive, stock_on_hand, avg_cost"
    )
    .order("name");

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
    };
  });

  return <ProductSection rows={rows} />;
}

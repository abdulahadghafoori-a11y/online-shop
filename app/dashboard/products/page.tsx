import { createClient } from "@/lib/supabaseServer";
import {
  ProductSection,
  type ProductCatalogRow,
} from "@/components/dashboard/ProductSection";

export default async function ProductsPage() {
  const supabase = await createClient();

  const [{ data: products }, { data: balances }, { data: costs }] =
    await Promise.all([
      supabase
        .from("products")
        .select("id, name, sku, defaultsaleprice, isactive")
        .order("name"),
      supabase.from("inventorybalance").select("productid, stockonhand"),
      supabase
        .from("productcosts")
        .select("productid, unitcost, createdat")
        .order("createdat", { ascending: false }),
    ]);

  const stock = new Map<string, number>(
    (balances ?? []).map((b) => [b.productid, Number(b.stockonhand)])
  );

  const latestCost = new Map<string, number>();
  for (const c of costs ?? []) {
    if (!latestCost.has(c.productid)) {
      latestCost.set(c.productid, Number(c.unitcost));
    }
  }

  const rows: ProductCatalogRow[] = (products ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    sku: p.sku,
    defaultsaleprice: Number(p.defaultsaleprice),
    isactive: p.isactive !== false,
    stockonhand: stock.get(p.id) ?? 0,
    latestunitcost: latestCost.get(p.id) ?? null,
  }));

  return <ProductSection rows={rows} />;
}

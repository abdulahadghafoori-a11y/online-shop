import { createClient } from "@/lib/supabaseServer";
import { OrderForm } from "@/components/dashboard/OrderForm";

type AdRow = {
  id: string;
  name: string;
  adsets:
    | { name: string; campaigns: { name: string } | { name: string }[] | null }
    | { name: string; campaigns: { name: string } | { name: string }[] | null }[]
    | null;
};

function adLabel(row: AdRow): string {
  const adName = row.name;
  const adsetRaw = row.adsets;
  const adset = Array.isArray(adsetRaw) ? adsetRaw[0] : adsetRaw;
  if (!adset) return adName;
  const campRaw = adset.campaigns;
  const camp = Array.isArray(campRaw) ? campRaw[0] : campRaw;
  const c = camp?.name;
  const s = adset.name;
  if (c && s) return `${c} › ${s} › ${adName}`;
  if (s) return `${s} › ${adName}`;
  return adName;
}

export default async function NewOrderPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: adsRaw }] = await Promise.all([
    supabase
      .from("products")
      .select("id, name, sku, defaultsaleprice")
      .eq("isactive", true)
      .order("name"),
    supabase
      .from("ads")
      .select(
        `
        id,
        name,
        adsets (
          name,
          campaigns ( name )
        )
      `,
      )
      .order("name"),
  ]);

  const ads = (adsRaw ?? []).map((r) => ({
    id: (r as AdRow).id,
    label: adLabel(r as AdRow),
  }));

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">New order</h1>
      <OrderForm products={products ?? []} ads={ads} />
    </div>
  );
}

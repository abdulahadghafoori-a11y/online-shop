import { createClient } from "@/lib/supabaseServer";
import { OrderForm } from "@/components/dashboard/OrderForm";

export default async function NewOrderPage() {
  const supabase = await createClient();
  const { data: products } = await supabase
    .from("products")
    .select("id, name, sku, defaultsaleprice")
    .eq("isactive", true)
    .order("name");

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold tracking-tight">New order</h1>
      <OrderForm products={products ?? []} />
    </div>
  );
}

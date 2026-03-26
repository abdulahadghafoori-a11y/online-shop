import { customAlphabet } from "nanoid";
import type { SupabaseClient } from "@supabase/supabase-js";

const skuBody = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 10);

/**
 * Generate a human-readable SKU (`P-` + 10 chars) and ensure it is not used
 * in `products.sku` (case-sensitive unique index).
 */
export async function allocateUniqueProductSku(
  supabase: SupabaseClient
): Promise<{ sku: string } | { error: string }> {
  for (let i = 0; i < 20; i++) {
    const sku = `P-${skuBody()}`;
    const { data, error } = await supabase
      .from("products")
      .select("id")
      .eq("sku", sku)
      .maybeSingle();
    if (error) return { error: error.message };
    if (!data) return { sku };
  }
  return { error: "Could not generate a unique SKU. Try again." };
}

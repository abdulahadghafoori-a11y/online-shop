"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { getAppUserIdForAuthUser } from "@/lib/authApi";
import { StockAdjustmentSchema } from "@/lib/validation";

export type AdjustmentActionState = {
  error?: string;
  ok?: boolean;
};

export async function createStockAdjustmentAction(
  _prev: AdjustmentActionState,
  formData: FormData
): Promise<AdjustmentActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const productid = String(formData.get("productid") ?? "").trim();
  const quantityRaw = String(formData.get("quantity") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  const parsed = StockAdjustmentSchema.safeParse({
    productid,
    quantity: parseInt(quantityRaw, 10),
    reason,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const { productid: pid, quantity, reason: adjustReason } = parsed.data;
  const createdBy = await getAppUserIdForAuthUser(user.id);

  const { data: product } = await supabase
    .from("products")
    .select("id")
    .eq("id", pid)
    .single();

  if (!product) return { error: "Product not found" };

  const { error: adjErr } = await supabase
    .from("stock_adjustments")
    .insert({
      product_id: pid,
      quantity,
      reason: adjustReason,
      created_by: createdBy,
    });

  if (adjErr) return { error: adjErr.message };

  const { error: invErr } = await supabase
    .from("inventorytransactions")
    .insert({
      productid: pid,
      type: "adjustment" as const,
      quantity,
      unitcost: null,
      referenceid: null,
    });

  if (invErr) return { error: `Adjustment saved but inventory update failed: ${invErr.message}` };

  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/products");
  return { ok: true };
}

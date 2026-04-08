"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { allocateUniqueProductSku } from "@/lib/productSku";
import { displayInputToBaseAmount } from "@/lib/formMoneyServer";
import { roundMoney6 } from "@/lib/amountConversion";
import { CreateProductSchema, UpdateProductSchema } from "@/lib/validation";

export type ProductActionState = {
  error?: string;
  ok?: boolean;
};

function zodIssuesMessage(err: { issues: { message: string }[] }) {
  return err.issues.map((i) => i.message).join("; ");
}

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("defaultsaleprice") ?? "");
  const isActive = formData.get("isactive") === "true";
  const initialCostRaw = String(formData.get("initialunitcost") ?? "").trim();
  const reorderRaw = String(formData.get("reorder_point") ?? "0").trim();

  const initialunitcost =
    initialCostRaw.length > 0
      ? parseFloat(initialCostRaw.replace(/,/g, ""))
      : undefined;

  const validated = CreateProductSchema.safeParse({
    name,
    defaultsaleprice: parseFloat(priceRaw.replace(/,/g, "")),
    isactive: isActive,
    initialunitcost,
    reorder_point: parseInt(reorderRaw, 10) || 0,
  });

  if (!validated.success) {
    return { error: zodIssuesMessage(validated.error) };
  }

  const skuAlloc = await allocateUniqueProductSku(supabase);
  if ("error" in skuAlloc) {
    return { error: skuAlloc.error };
  }
  const sku = skuAlloc.sku;

  const priceInBase = await displayInputToBaseAmount(priceRaw);
  if (!priceInBase.ok) {
    return { error: "Enter a valid default sale price." };
  }
  const defaultsaleprice = priceInBase.value;

  let initialUnitcost: number | undefined;
  if (initialCostRaw.length > 0) {
    const costInBase = await displayInputToBaseAmount(initialCostRaw);
    if (!costInBase.ok) {
      return { error: "Enter a valid initial unit cost or leave it blank." };
    }
    initialUnitcost = costInBase.value;
  }

  const waMessage = String(formData.get("wa_message") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;

  const { error: insertErr } = await supabase
    .from("products")
    .insert({
      name: validated.data.name,
      sku,
      defaultsaleprice,
      isactive: validated.data.isactive,
      avg_cost: initialUnitcost ?? 0,
      stock_on_hand: 0,
      wa_message: waMessage,
      description,
      image_url: imageUrl,
      reorder_point: validated.data.reorder_point,
    })
    .select("id")
    .single();

  if (insertErr) {
    return {
      error:
        insertErr.code === "23505"
          ? "That SKU is already used."
          : insertErr.message,
    };
  }

  revalidatePath("/dashboard/products");
  return { ok: true };
}

export async function updateProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("defaultsaleprice") ?? "");
  const isActive = formData.get("isactive") === "true";
  const reorderRaw = String(formData.get("reorder_point") ?? "0").trim();

  const validated = UpdateProductSchema.safeParse({
    id,
    name,
    defaultsaleprice: parseFloat(priceRaw.replace(/,/g, "")),
    isactive: isActive,
    reorder_point: parseInt(reorderRaw, 10) || 0,
  });

  if (!validated.success) {
    return { error: zodIssuesMessage(validated.error) };
  }

  const priceInBase = await displayInputToBaseAmount(priceRaw);
  if (!priceInBase.ok) {
    return { error: "Enter a valid default sale price." };
  }
  const defaultsaleprice = priceInBase.value;

  const waMessage = String(formData.get("wa_message") ?? "").trim() || null;
  const description = String(formData.get("description") ?? "").trim() || null;
  const imageUrl = String(formData.get("image_url") ?? "").trim() || null;

  const { error } = await supabase
    .from("products")
    .update({
      name: validated.data.name,
      defaultsaleprice,
      isactive: validated.data.isactive,
      wa_message: waMessage,
      description,
      image_url: imageUrl,
      reorder_point: validated.data.reorder_point,
    })
    .eq("id", validated.data.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${validated.data.id}`);
  return { ok: true };
}

export async function deleteProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Missing product ID" };

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return { error: "Cannot delete: this product has existing orders. Set it to Inactive instead." };
    }
    return { error: error.message };
  }

  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}

// ─── Receive Stock ──────────────────────────────────────────────

export type ReceiveStockState = { error?: string; ok?: boolean };

export async function receiveStockAction(
  _prev: ReceiveStockState,
  formData: FormData,
): Promise<ReceiveStockState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const productId = String(formData.get("productId") ?? "").trim();
  const qty = parseInt(String(formData.get("qty") ?? "0"), 10);
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!productId) return { error: "Missing product" };
  if (qty <= 0) return { error: "Quantity must be positive" };

  const [baseRes, shipRes, packRes] = await Promise.all([
    displayInputToBaseAmount(String(formData.get("base_cost") ?? "0")),
    displayInputToBaseAmount(String(formData.get("shipping") ?? "0")),
    displayInputToBaseAmount(String(formData.get("packaging") ?? "0")),
  ]);

  if (!baseRes.ok || !shipRes.ok || !packRes.ok) {
    return { error: "Invalid cost value" };
  }

  const b = roundMoney6(baseRes.value);
  const s = roundMoney6(shipRes.value);
  const p = roundMoney6(packRes.value);

  if (b + s + p <= 0) {
    return { error: "Total cost must be positive (base + shipping + packaging)" };
  }

  const { error: rpcErr } = await supabase.rpc("apply_stock_receipt", {
    p_product_id: productId,
    p_qty: qty,
    p_base_cost: b,
    p_shipping_cost_per_unit: s,
    p_packaging_cost_per_unit: p,
    p_notes: notes,
    p_received_date: new Date().toISOString().split("T")[0],
  });

  if (rpcErr) return { error: rpcErr.message };

  revalidatePath(`/dashboard/products/${productId}`);
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/inventory");
  return { ok: true };
}

"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { getAppUserIdForAuthUser } from "@/lib/authApi";
import { displayInputToBaseAmount } from "@/lib/formMoneyServer";
import { roundMoney6 } from "@/lib/amountConversion";
import { CreatePurchaseSchema } from "@/lib/validation";

export type PurchaseActionState = {
  error?: string;
  ok?: boolean;
};

export async function createPurchaseOrderAction(
  _prev: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const suppliername = String(formData.get("suppliername") ?? "").trim();
  const rawItems = formData.get("items");

  let parsedItems: {
    productid: string;
    quantity: number;
    base_cost: number;
    shipping_cost_per_unit: number;
    packaging_cost_per_unit: number;
  }[];
  try {
    parsedItems = JSON.parse(String(rawItems ?? "[]"));
  } catch {
    return { error: "Invalid items payload" };
  }

  const result = CreatePurchaseSchema.safeParse({
    suppliername,
    items: parsedItems,
  });
  if (!result.success) {
    return { error: result.error.issues.map((i) => i.message).join("; ") };
  }

  const createdBy = await getAppUserIdForAuthUser(user.id);

  let convertedItems: {
    productid: string;
    quantity: number;
    base_cost_base: number;
    shipping_base: number;
    packaging_base: number;
    unit_cost_base: number;
  }[];
  try {
    convertedItems = await Promise.all(
      result.data.items.map(async (item) => {
        const [b, s, p] = await Promise.all([
          displayInputToBaseAmount(String(item.base_cost)),
          displayInputToBaseAmount(String(item.shipping_cost_per_unit)),
          displayInputToBaseAmount(String(item.packaging_cost_per_unit)),
        ]);
        if (!b.ok || !s.ok || !p.ok) {
          throw new Error("Invalid cost on a line item");
        }
        const unitTotal = roundMoney6(b.value + s.value + p.value);
        return {
          productid: item.productid,
          quantity: item.quantity,
          base_cost_base: b.value,
          shipping_base: s.value,
          packaging_base: p.value,
          unit_cost_base: unitTotal,
        };
      })
    );
  } catch (e) {
    return {
      error:
        e instanceof Error ? e.message : "Could not convert line item costs",
    };
  }

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      supplier_name: result.data.suppliername,
      status: "draft",
      created_by: createdBy,
    })
    .select("id")
    .single();

  if (poErr || !po) return { error: poErr?.message ?? "Failed to create PO" };

  const { error: itemErr } = await supabase
    .from("purchase_order_items")
    .insert(
      convertedItems.map((item) => ({
        purchase_order_id: po.id,
        product_id: item.productid,
        quantity: item.quantity,
        unit_cost: item.unit_cost_base,
        base_cost: item.base_cost_base,
        shipping_cost_per_unit: item.shipping_base,
        packaging_cost_per_unit: item.packaging_base,
      }))
    );

  if (itemErr) return { error: `PO created but items failed: ${itemErr.message}` };

  revalidatePath("/dashboard/purchases");
  return { ok: true };
}

export async function receivePurchaseOrderAction(
  _prev: PurchaseActionState,
  formData: FormData
): Promise<PurchaseActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const poId = String(formData.get("id") ?? "").trim();
  if (!poId) return { error: "Missing purchase order ID" };

  const { data: po } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("id", poId)
    .single();

  if (!po) return { error: "Purchase order not found" };
  if (po.status !== "draft") return { error: "Only draft POs can be received" };

  const { data: items } = await supabase
    .from("purchase_order_items")
    .select(
      "product_id, quantity, unit_cost, base_cost, shipping_cost_per_unit, packaging_cost_per_unit"
    )
    .eq("purchase_order_id", poId);

  if (!items?.length) return { error: "PO has no items" };

  for (const item of items) {
    const qtyInt = Math.max(1, Math.round(Number(item.quantity)));
    const { error: recvErr } = await supabase.rpc("apply_stock_receipt", {
      p_product_id: item.product_id,
      p_qty: qtyInt,
      p_base_cost: Number(item.base_cost ?? 0),
      p_shipping_cost_per_unit: Number(item.shipping_cost_per_unit ?? 0),
      p_packaging_cost_per_unit: Number(item.packaging_cost_per_unit ?? 0),
      p_notes: `purchase_order:${poId}`,
      p_received_date: new Date().toISOString().slice(0, 10),
    });
    if (recvErr) {
      return { error: `Stock receipt failed: ${recvErr.message}` };
    }
  }

  const { error: updateErr } = await supabase
    .from("purchase_orders")
    .update({ status: "received", received_at: new Date().toISOString() })
    .eq("id", poId);

  if (updateErr) return { error: `Mark received failed: ${updateErr.message}` };

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/products");
  return { ok: true };
}

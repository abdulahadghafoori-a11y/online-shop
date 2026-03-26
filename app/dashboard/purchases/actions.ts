"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { getAppUserIdForAuthUser } from "@/lib/authApi";
import { displayInputToBaseAmount } from "@/lib/formMoneyServer";
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

  let parsedItems: { productid: string; quantity: number; unitcost: number }[];
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

  const convertedItems = await Promise.all(
    result.data.items.map(async (item) => {
      const converted = await displayInputToBaseAmount(String(item.unitcost));
      if (!converted.ok) throw new Error(`Invalid unit cost for product`);
      return { ...item, unit_cost_base: converted.value };
    })
  );

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
    .select("product_id, quantity, unit_cost")
    .eq("purchase_order_id", poId);

  if (!items?.length) return { error: "PO has no items" };

  const { error: invErr } = await supabase
    .from("inventorytransactions")
    .insert(
      items.map((item) => ({
        productid: item.product_id,
        type: "purchase" as const,
        quantity: item.quantity,
        unitcost: item.unit_cost,
        referenceid: poId,
      }))
    );

  if (invErr) return { error: `Inventory update failed: ${invErr.message}` };

  for (const item of items) {
    const { error: costErr } = await supabase.from("productcosts").insert({
      productid: item.product_id,
      unitcost: item.unit_cost,
    });
    if (costErr) console.error("Cost insert failed:", costErr.message);
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

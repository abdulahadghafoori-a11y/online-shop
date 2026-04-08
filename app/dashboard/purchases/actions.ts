"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { getAppUserIdForAuthUser } from "@/lib/authApi";
import { displayInputToBaseAmount } from "@/lib/formMoneyServer";
import { roundMoney6 } from "@/lib/amountConversion";
import { CreatePurchaseSchema } from "@/lib/validation";
import { getFxSnapshotForRequest } from "@/lib/fxSnapshotServer";

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

  const supplierNameRaw = String(formData.get("suppliername") ?? "").trim();
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
    suppliername: supplierNameRaw,
    items: parsedItems,
  });
  if (!result.success) {
    return { error: result.error.issues.map((i) => i.message).join("; ") };
  }

  const createdBy = await getAppUserIdForAuthUser(user.id);

  const supplierName = result.data.suppliername;
  const { data: existingSupplier } = await supabase
    .from("suppliers")
    .select("id")
    .eq("name", supplierName)
    .maybeSingle();

  let supplierId: string;
  if (existingSupplier) {
    supplierId = existingSupplier.id;
  } else {
    const { data: newSupplier, error: supErr } = await supabase
      .from("suppliers")
      .insert({ name: supplierName })
      .select("id")
      .single();
    if (supErr || !newSupplier)
      return { error: supErr?.message ?? "Failed to create supplier" };
    supplierId = newSupplier.id;
  }

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

  const fxSnap = await getFxSnapshotForRequest();

  const { data: po, error: poErr } = await supabase
    .from("purchase_orders")
    .insert({
      supplier_id: supplierId,
      status: "draft",
      created_by: createdBy,
      fx_afn_per_usd: fxSnap.afnPerUsd,
      fx_cny_per_usd: fxSnap.cnyPerUsd,
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

  if (itemErr) {
    await supabase.from("purchase_orders").delete().eq("id", po.id);
    return { error: `Failed to save line items: ${itemErr.message}` };
  }

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

  const { error: rpcErr } = await supabase.rpc("receive_purchase_order", {
    p_po_id: poId,
  });

  if (rpcErr) {
    const msg = rpcErr.message;
    if (msg.includes("not found")) return { error: "Purchase order not found" };
    if (msg.includes("Only draft")) return { error: "Only draft POs can be received" };
    return { error: `Stock receipt failed: ${msg}` };
  }

  revalidatePath("/dashboard/purchases");
  revalidatePath("/dashboard/products");
  return { ok: true };
}

export async function cancelPurchaseOrderAction(
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

  const { data: po, error: fetchErr } = await supabase
    .from("purchase_orders")
    .select("id, status")
    .eq("id", poId)
    .maybeSingle();

  if (fetchErr || !po) return { error: "Purchase order not found" };
  if (po.status !== "draft") {
    return { error: "Only draft purchase orders can be cancelled." };
  }

  const { error: updErr } = await supabase
    .from("purchase_orders")
    .update({ status: "cancelled" })
    .eq("id", poId);

  if (updErr) return { error: updErr.message };

  revalidatePath("/dashboard/purchases");
  return { ok: true };
}

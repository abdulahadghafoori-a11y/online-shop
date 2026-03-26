"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { allocateUniqueProductSku } from "@/lib/productSku";
import { displayInputToBaseAmount } from "@/lib/formMoneyServer";

export type ProductActionState = {
  error?: string;
  ok?: boolean;
};

export async function createProductAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createClient();
  const name = String(formData.get("name") ?? "").trim();
  const priceRaw = String(formData.get("defaultsaleprice") ?? "");
  const isActive = formData.get("isactive") === "true";
  const initialCostRaw = String(formData.get("initialunitcost") ?? "").trim();

  if (!name) {
    return { error: "Name is required." };
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

  const { data: inserted, error: insertErr } = await supabase
    .from("products")
    .insert({
      name,
      sku,
      defaultsaleprice,
      isactive: isActive,
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

  if (initialUnitcost !== undefined) {
    const { error: costErr } = await supabase.from("productcosts").insert({
      productid: inserted.id,
      unitcost: initialUnitcost,
    });
    if (costErr) {
      return { error: `Product saved; cost row failed: ${costErr.message}` };
    }
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

  if (!id || !name) {
    return { error: "Missing product or required fields." };
  }
  const priceInBase = await displayInputToBaseAmount(priceRaw);
  if (!priceInBase.ok) {
    return { error: "Enter a valid default sale price." };
  }
  const defaultsaleprice = priceInBase.value;

  const { error } = await supabase
    .from("products")
    .update({
      name,
      defaultsaleprice,
      isactive: isActive,
    })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/products");
  return { ok: true };
}

export async function addProductCostAction(
  _prev: ProductActionState,
  formData: FormData
): Promise<ProductActionState> {
  const supabase = await createClient();
  const productid = String(formData.get("productid") ?? "").trim();
  const costRaw = String(formData.get("unitcost") ?? "");

  if (!productid) {
    return { error: "Missing product." };
  }
  const costInBase = await displayInputToBaseAmount(costRaw);
  if (!costInBase.ok) {
    return { error: "Enter a valid unit cost." };
  }
  const unitcost = costInBase.value;

  const { error } = await supabase.from("productcosts").insert({
    productid,
    unitcost,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/products");
  return { ok: true };
}

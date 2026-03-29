"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { allocateUniqueProductSku } from "@/lib/productSku";
import { displayInputToBaseAmount } from "@/lib/formMoneyServer";
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

  const initialunitcost =
    initialCostRaw.length > 0
      ? parseFloat(initialCostRaw.replace(/,/g, ""))
      : undefined;

  const validated = CreateProductSchema.safeParse({
    name,
    defaultsaleprice: parseFloat(priceRaw.replace(/,/g, "")),
    isactive: isActive,
    initialunitcost,
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

  const { data: inserted, error: insertErr } = await supabase
    .from("products")
    .insert({
      name: validated.data.name,
      sku,
      defaultsaleprice,
      isactive: validated.data.isactive,
      avg_cost: initialUnitcost ?? 0,
      stock_on_hand: 0,
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

  const validated = UpdateProductSchema.safeParse({
    id,
    name,
    defaultsaleprice: parseFloat(priceRaw.replace(/,/g, "")),
    isactive: isActive,
  });

  if (!validated.success) {
    return { error: zodIssuesMessage(validated.error) };
  }

  const priceInBase = await displayInputToBaseAmount(priceRaw);
  if (!priceInBase.ok) {
    return { error: "Enter a valid default sale price." };
  }
  const defaultsaleprice = priceInBase.value;

  const { error } = await supabase
    .from("products")
    .update({
      name: validated.data.name,
      defaultsaleprice,
      isactive: validated.data.isactive,
    })
    .eq("id", validated.data.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/dashboard/products");
  revalidatePath(`/dashboard/products/${validated.data.id}`);
  return { ok: true };
}

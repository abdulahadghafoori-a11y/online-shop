"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { optionalDisplayMoneyToBase } from "@/lib/formMoneyServer";
import { roundMoney6 } from "@/lib/amountConversion";
import { z } from "zod";

export type StockReceiptState = { error?: string; ok?: boolean };

const ReceiptSchema = z.object({
  productId: z.string().uuid(),
  qty: z.number().int().positive(),
  notes: z.string().max(2000).optional(),
});

export async function createStockReceiptAction(
  _prev: StockReceiptState,
  formData: FormData
): Promise<StockReceiptState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const productId = String(formData.get("product_id") ?? "").trim();
  const qty = parseInt(String(formData.get("qty_received") ?? ""), 10);
  const baseRaw = String(formData.get("base_cost") ?? "");
  const shipRaw = String(formData.get("shipping_cost_per_unit") ?? "");
  const packRaw = String(formData.get("packaging_cost_per_unit") ?? "");
  const notesRaw = String(formData.get("notes") ?? "").trim();
  const receivedRaw = String(formData.get("received_date") ?? "").trim();

  const [b, s, p] = await Promise.all([
    optionalDisplayMoneyToBase(baseRaw),
    optionalDisplayMoneyToBase(shipRaw),
    optionalDisplayMoneyToBase(packRaw),
  ]);
  if (!b.ok) return { error: "Enter a valid base cost or leave it blank." };
  if (!s.ok) {
    return { error: "Enter a valid shipping cost per unit or leave it blank." };
  }
  if (!p.ok) {
    return { error: "Enter a valid packaging cost per unit or leave it blank." };
  }
  const unitTotal = roundMoney6(b.value + s.value + p.value);
  if (unitTotal <= 0) {
    return {
      error:
        "Total unit cost must be positive (sum base + shipping + packaging).",
    };
  }

  const parsed = ReceiptSchema.safeParse({
    productId,
    qty,
    notes: notesRaw.length ? notesRaw : undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  let receivedDate = new Date().toISOString().slice(0, 10);
  if (receivedRaw.length >= 10) {
    const d = new Date(receivedRaw.slice(0, 10));
    if (!Number.isNaN(d.getTime())) {
      receivedDate = d.toISOString().slice(0, 10);
    }
  }

  const { data, error } = await supabase.rpc("apply_stock_receipt", {
    p_product_id: parsed.data.productId,
    p_qty: parsed.data.qty,
    p_base_cost: b.value,
    p_shipping_cost_per_unit: s.value,
    p_packaging_cost_per_unit: p.value,
    p_notes: parsed.data.notes ?? null,
    p_received_date: receivedDate,
  });

  if (error) {
    return { error: error.message };
  }

  void data;
  revalidatePath("/dashboard/products");
  revalidatePath("/dashboard/products/" + parsed.data.productId);
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/purchases");
  return { ok: true };
}

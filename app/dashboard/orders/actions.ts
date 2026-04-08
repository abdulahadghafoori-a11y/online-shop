"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabaseServer";

const orderStatusSchema = z.enum([
  "pending",
  "confirmed",
  "shipped",
  "delivered",
  "cancelled",
]);

export type OrderDashboardActionState = {
  error?: string;
  ok?: boolean;
};

export async function updateOrderDetailsAction(
  _prev: OrderDashboardActionState,
  formData: FormData,
): Promise<OrderDashboardActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = String(formData.get("id") ?? "").trim();
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid order" };
  }

  const statusRaw = String(formData.get("status") ?? "").trim();
  const statusParsed = orderStatusSchema.safeParse(statusRaw);
  if (!statusParsed.success) return { error: "Invalid status" };
  if (statusParsed.data === "cancelled") {
    return { error: "Use the Cancel order action instead of setting status to cancelled." };
  }

  const deliveryaddress = String(
    formData.get("deliveryaddress") ?? "",
  ).trim();
  if (!deliveryaddress) return { error: "Province / address is required" };

  const trackingRaw = String(formData.get("trackingnumber") ?? "").trim();
  const trackingnumber = trackingRaw.length > 0 ? trackingRaw : null;

  const notesRaw = String(formData.get("notes") ?? "").trim();
  const notes = notesRaw.length > 0 ? notesRaw : null;

  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("id, status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) return { error: "Order not found" };
  if (row.status === "cancelled") {
    return { error: "Reopen or edit is not supported for cancelled orders." };
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update({
      status: statusParsed.data,
      deliveryaddress,
      trackingnumber,
      notes,
      updatedat: new Date().toISOString(),
    })
    .eq("id", id);

  if (updErr) return { error: updErr.message };

  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

export async function cancelOrderAction(
  _prev: OrderDashboardActionState,
  formData: FormData,
): Promise<OrderDashboardActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = String(formData.get("id") ?? "").trim();
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid order" };
  }

  const { error: rpcErr } = await supabase.rpc(
    "cancel_order_and_restore_stock",
    { p_order_id: id },
  );

  if (rpcErr) {
    const msg = rpcErr.message;
    if (msg.includes("already cancelled")) return { error: "Order is already cancelled." };
    if (msg.includes("Only pending/confirmed"))
      return { error: "Only pending or confirmed orders can be cancelled." };
    return { error: msg };
  }

  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/orders");
  revalidatePath("/dashboard/products");
  return { ok: true };
}

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

  const { data: row, error: fetchErr } = await supabase
    .from("orders")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row) return { error: "Order not found" };
  if (row.status === "cancelled") return { error: "Order is already cancelled." };
  if (!["pending", "confirmed"].includes(row.status)) {
    return {
      error:
        "Only pending or confirmed orders can be cancelled. Shipped inventory is not returned automatically.",
    };
  }

  const { error: updErr } = await supabase
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", id);

  if (updErr) return { error: updErr.message };

  revalidatePath(`/dashboard/orders/${id}`);
  revalidatePath("/dashboard/orders");
  return { ok: true };
}

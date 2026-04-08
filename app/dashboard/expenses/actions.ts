"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabaseServer";
import { displayInputToBaseAmount } from "@/lib/formMoneyServer";
import { CreateExpenseSchema, UpdateExpenseSchema } from "@/lib/validation";
import { z } from "zod";

export type ExpenseActionState = {
  error?: string;
  ok?: boolean;
};

export async function createExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const category = String(formData.get("category") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const amountResult = await displayInputToBaseAmount(amountRaw);
  if (!amountResult.ok) return { error: "Invalid amount" };

  const parsed = CreateExpenseSchema.safeParse({
    category,
    amount: amountResult.value,
    date,
    notes: notes || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const { error: insertErr } = await supabase.from("expenses").insert({
    category: parsed.data.category,
    amount: parsed.data.amount,
    date: parsed.data.date,
    notes: parsed.data.notes ?? null,
  });

  if (insertErr) return { error: insertErr.message };

  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

export async function updateExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = String(formData.get("id") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const amountRaw = String(formData.get("amount") ?? "");
  const date = String(formData.get("date") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  const amountResult = await displayInputToBaseAmount(amountRaw);
  if (!amountResult.ok) return { error: "Invalid amount" };

  const parsed = UpdateExpenseSchema.safeParse({
    id,
    category,
    amount: amountResult.value,
    date,
    notes: notes || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join("; ") };
  }

  const { error: updErr } = await supabase
    .from("expenses")
    .update({
      category: parsed.data.category,
      amount: parsed.data.amount,
      date: parsed.data.date,
      notes: parsed.data.notes ?? null,
    })
    .eq("id", parsed.data.id);

  if (updErr) return { error: updErr.message };

  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

export async function deleteExpenseAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = String(formData.get("id") ?? "").trim();
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid expense ID" };
  }

  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

export async function createCategoryAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Category name is required" };

  const { error: insertErr } = await supabase
    .from("expense_categories")
    .insert({ name });

  if (insertErr) {
    if (insertErr.message.includes("duplicate") || insertErr.message.includes("unique")) {
      return { error: "A category with that name already exists" };
    }
    return { error: insertErr.message };
  }

  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

export async function updateCategoryAction(
  _prev: ExpenseActionState,
  formData: FormData,
): Promise<ExpenseActionState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized" };

  const id = String(formData.get("id") ?? "").trim();
  if (!z.string().uuid().safeParse(id).success) {
    return { error: "Invalid category ID" };
  }

  const newName = String(formData.get("name") ?? "").trim();
  if (!newName) return { error: "Category name is required" };

  const { data: existing } = await supabase
    .from("expense_categories")
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return { error: "Category not found" };

  const oldName = existing.name;

  const { error: updErr } = await supabase
    .from("expense_categories")
    .update({ name: newName })
    .eq("id", id);

  if (updErr) {
    if (updErr.message.includes("duplicate") || updErr.message.includes("unique")) {
      return { error: "A category with that name already exists" };
    }
    return { error: updErr.message };
  }

  if (oldName !== newName) {
    await supabase
      .from("expenses")
      .update({ category: newName })
      .eq("category", oldName);
  }

  revalidatePath("/dashboard/expenses");
  return { ok: true };
}

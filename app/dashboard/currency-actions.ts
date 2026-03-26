"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  APP_CURRENCY_COOKIE_NAME,
  normalizeAppCurrency,
} from "@/lib/currency";
import { createClient } from "@/lib/supabaseServer";

export async function setAppCurrencyAction(code: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const normalized = normalizeAppCurrency(code);
  const store = await cookies();
  store.set(APP_CURRENCY_COOKIE_NAME, normalized, {
    path: "/",
    maxAge: 60 * 60 * 24 * 400,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  revalidatePath("/dashboard", "layout");
}

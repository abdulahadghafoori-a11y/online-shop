"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { APP_FX_SNAPSHOT_COOKIE_NAME } from "@/lib/currency";
import { createClient } from "@/lib/supabaseServer";
import { fetchFxLive } from "@/lib/exchangeRates";

export type FxActionResult = { ok: true } | { ok: false; error: string };

const cookieOpts = {
  path: "/",
  maxAge: 60 * 60 * 24 * 120,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export async function refreshFxRatesAction(): Promise<FxActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  try {
    const r = await fetchFxLive();
    const store = await cookies();
    store.set(
      APP_FX_SNAPSHOT_COOKIE_NAME,
      JSON.stringify({
        afnPerUsd: r.afnPerUsd,
        cnyPerUsd: r.cnyPerUsd,
        rateDate: r.rateDate,
        source: "live",
      }),
      cookieOpts
    );
    revalidatePath("/dashboard", "layout");
    return { ok: true };
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not fetch live rates.";
    return {
      ok: false,
      error: `${msg} You can enter manual rates in the dialog instead.`,
    };
  }
}

export async function setManualFxRatesAction(
  _prev: FxActionResult | undefined,
  formData: FormData
): Promise<FxActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const afnRaw = String(formData.get("afn_per_usd") ?? "").trim();
  const afnCnyRaw = String(formData.get("afn_per_cny") ?? "").trim();
  const afn = parseFloat(afnRaw.replace(/,/g, ""));
  const afnPerCny = parseFloat(afnCnyRaw.replace(/,/g, ""));

  if (!Number.isFinite(afn) || afn <= 0) {
    return { ok: false, error: "AFN per 1 USD must be a positive number." };
  }
  if (!Number.isFinite(afnPerCny) || afnPerCny <= 0) {
    return { ok: false, error: "AFN per 1 CNY must be a positive number." };
  }

  const cnyPerUsd = afn / afnPerCny;
  if (!Number.isFinite(cnyPerUsd) || cnyPerUsd <= 0) {
    return { ok: false, error: "Could not derive CNY per USD from your inputs." };
  }

  const store = await cookies();
  store.set(
    APP_FX_SNAPSHOT_COOKIE_NAME,
    JSON.stringify({
      afnPerUsd: afn,
      cnyPerUsd,
      rateDate: new Date().toISOString().slice(0, 10),
      source: "manual",
    }),
    cookieOpts
  );
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

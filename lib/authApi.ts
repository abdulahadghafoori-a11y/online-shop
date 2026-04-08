import type { User } from "@supabase/supabase-js";
import { createClient } from "./supabaseServer";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Returns the session user only if their app profile role is admin. */
export async function getAdminSessionUser(): Promise<User | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("authid", user.id)
    .maybeSingle();
  if (data?.role !== "admin") return null;
  return user;
}

/** For API routes: distinguish missing session (401) vs non-admin (403). */
export async function requireAdminApiUser(): Promise<
  { ok: true; user: User } | { ok: false; status: 401 | 403; message: string }
> {
  const user = await getSessionUser();
  if (!user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("authid", user.id)
    .maybeSingle();
  if (data?.role !== "admin") {
    return {
      ok: false,
      status: 403,
      message: "Forbidden — Meta sync is limited to admins.",
    };
  }
  return { ok: true, user };
}

export async function getAppUserIdForAuthUser(authUserId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("authid", authUserId)
    .maybeSingle();
  return data?.id ?? null;
}

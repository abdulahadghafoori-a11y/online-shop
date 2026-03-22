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

export async function getAppUserIdForAuthUser(authUserId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("users")
    .select("id")
    .eq("authid", authUserId)
    .maybeSingle();
  return data?.id ?? null;
}

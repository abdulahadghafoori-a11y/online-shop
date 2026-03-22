import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabaseServer";

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();

  const base =
    process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return NextResponse.redirect(new URL("/login", base), 302);
}

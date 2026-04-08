/**
 * Normalize phone for storage and Meta CAPI hashing (E.164-style: leading + and digits).
 * Does not infer country codes; callers should collect +country from ops when possible.
 */
export function normalizePhoneE164(input: string): string {
  const t = input.trim();
  if (!t) return t;
  const digits = t.replace(/\D/g, "");
  if (!digits) return t;
  if (t.startsWith("+")) return `+${digits}`;
  return `+${digits}`;
}

/** Values to match legacy rows stored with or without a leading +. */
export function phoneMatchVariants(phoneNormalized: string): string[] {
  const s = phoneNormalized.trim();
  const noPlus = s.replace(/^\+/, "");
  return [...new Set([s, noPlus].filter((x) => x.length > 0))];
}

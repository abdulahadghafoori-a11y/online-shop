/**
 * Best-effort per-process rate limiter for serverless-friendly routes.
 * For strict multi-instance limits, use Redis / edge middleware.
 */
const buckets = new Map<string, number[]>();

export function checkRateLimit(
  key: string,
  maxPerWindow: number,
  windowMs: number,
): { ok: boolean; retryAfterMs?: number } {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= maxPerWindow) {
    const oldest = arr[0]!;
    return { ok: false, retryAfterMs: windowMs - (now - oldest) };
  }
  arr.push(now);
  buckets.set(key, arr);
  return { ok: true };
}

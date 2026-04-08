/** Strip control chars and cap length for WhatsApp prefill query param. */
export function sanitizeRedirectProductName(
  raw: string,
  maxLen = 120,
): string {
  return raw
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

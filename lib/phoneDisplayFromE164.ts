import {
  COUNTRY_DIAL_OPTIONS,
  formatInternationalPhoneForDisplay,
} from "@/lib/countryDialCodes";

/**
 * Best-effort readable phone from stored value (usually E.164). Matches the
 * longest country dial prefix from `COUNTRY_DIAL_OPTIONS`, then applies the same
 * grouping as the order form review.
 */
export function formatStoredPhoneForDisplay(
  stored: string | null | undefined,
): string {
  if (stored == null || !String(stored).trim()) return "—";
  const raw = String(stored).trim();
  const digitsOnly = raw.replace(/\D/g, "");
  if (!digitsOnly) return raw;

  const withPlus = raw.startsWith("+") ? raw : `+${digitsOnly}`;

  const byDialLen = [...COUNTRY_DIAL_OPTIONS].sort(
    (a, b) => b.dial.length - a.dial.length,
  );

  for (const opt of byDialLen) {
    const d = opt.dial.trim().startsWith("+")
      ? opt.dial.trim()
      : `+${opt.dial.trim()}`;
    if (withPlus.startsWith(d)) {
      const local = withPlus.slice(d.length);
      return formatInternationalPhoneForDisplay(d, local);
    }
  }

  return withPlus;
}

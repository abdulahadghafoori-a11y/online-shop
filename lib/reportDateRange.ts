const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate and normalize a date query param. Returns the sanitized YYYY-MM-DD
 * string or the fallback when the input is missing / malformed.
 */
export function parseReportDateParam(
  raw: string | null,
  fallback: string,
): string {
  if (!raw || !ISO_DATE_RE.test(raw)) return fallback;
  const d = new Date(raw + "T00:00:00Z");
  if (Number.isNaN(d.getTime())) return fallback;
  return raw;
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0]!;
}

/** Inclusive `from` and inclusive `to` calendar dates (YYYY-MM-DD) → UTC half-open interval for timestamptz filters. */
export function reportRangeUtc(from: string, to: string): { start: string; endExclusive: string } {
  const start = `${from}T00:00:00.000Z`;
  const end = new Date(`${to}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, endExclusive: end.toISOString() };
}

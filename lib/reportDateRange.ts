/** Inclusive `from` and inclusive `to` calendar dates (YYYY-MM-DD) → UTC half-open interval for timestamptz filters. */
export function reportRangeUtc(from: string, to: string): { start: string; endExclusive: string } {
  const start = `${from}T00:00:00.000Z`;
  const end = new Date(`${to}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, endExclusive: end.toISOString() };
}

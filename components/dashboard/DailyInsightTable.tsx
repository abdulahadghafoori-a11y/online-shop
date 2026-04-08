import type { DailyInsightRow } from "@/lib/adInsightTotals";

type Props = {
  rows: DailyInsightRow[];
  formatMoney: (n: number) => string;
  title?: string;
  emptyMessage?: string;
};

export function DailyInsightTable({
  rows,
  formatMoney,
  title = "Daily breakdown",
  emptyMessage = "No daily rows for this range.",
}: Props) {
  if (!rows.length) {
    return (
      <p className="text-muted-foreground text-sm">{emptyMessage}</p>
    );
  }

  return (
    <div className="max-h-[380px] overflow-auto rounded-md border">
      <table className="w-full text-sm">
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr className="bg-muted/50 text-muted-foreground sticky top-0 border-b text-left text-xs">
            <th className="px-3 py-2 font-medium">Date</th>
            <th className="px-3 py-2 text-right font-medium">Spend</th>
            <th className="px-3 py-2 text-right font-medium">Clicks</th>
            <th className="px-3 py-2 text-right font-medium">Impr.</th>
            <th className="px-3 py-2 text-right font-medium">Reach</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.date}>
              <td className="px-3 py-2 whitespace-nowrap">{r.date}</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatMoney(r.spend)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.clicks.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.impressions.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {r.reach.toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

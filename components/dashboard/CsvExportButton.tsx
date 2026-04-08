"use client";

import { useCallback } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CsvExportButtonProps {
  /** API route that returns JSON (e.g. /api/reports/orders?from=...&to=...) */
  endpoint: string;
  /** Filename without extension */
  filename: string;
  /** Column headers (keys from the JSON response objects) */
  columns: { key: string; label: string }[];
  className?: string;
}

export function CsvExportButton({
  endpoint,
  filename,
  columns,
  className,
}: CsvExportButtonProps) {
  const exportCsv = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to fetch report data");
      const json = await res.json();
      const rows: Record<string, unknown>[] = Array.isArray(json)
        ? json
        : json.data ?? json.snapshot ?? [];

      const escape = (v: unknown) => {
        const str = v == null ? "" : String(v);
        return str.includes(",") || str.includes('"') || str.includes("\n")
          ? `"${str.replace(/"/g, '""')}"`
          : str;
      };

      const header = columns.map((c) => escape(c.label)).join(",");
      const body = rows
        .map((r) => columns.map((c) => escape(r[c.key])).join(","))
        .join("\n");

      const blob = new Blob([`${header}\n${body}`], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${filename}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert("CSV export failed. Check the console for details.");
    }
  }, [endpoint, filename, columns]);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={exportCsv}
      className={className}
    >
      <Download className="mr-1.5 size-4" />
      Export CSV
    </Button>
  );
}

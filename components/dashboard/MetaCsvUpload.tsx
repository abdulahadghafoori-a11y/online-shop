"use client";

import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type UploadResult = {
  ok: boolean;
  upserted: number;
  skipped: number;
  total: number;
  errors: string[];
};

export function MetaCsvUpload() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    if (
      !file.name.endsWith(".csv") &&
      !file.name.endsWith(".tsv") &&
      !file.name.endsWith(".txt")
    ) {
      toast.error("Please upload a CSV file exported from Meta Ads Manager");
      return;
    }

    setUploading(true);
    setResult(null);
    setFileName(file.name);

    try {
      const csv = await file.text();
      const res = await fetch("/api/meta/upload-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ csv }),
      });
      const json = (await res.json()) as UploadResult & { error?: string };

      if (!res.ok) {
        toast.error(json.error ?? "Upload failed");
        setResult(null);
        return;
      }

      setResult(json);
      if (json.upserted > 0) {
        toast.success(`${json.upserted} row${json.upserted === 1 ? "" : "s"} imported`);
      }
      if (json.skipped > 0) {
        toast.warning(`${json.skipped} row${json.skipped === 1 ? "" : "s"} skipped`);
      }
    } catch {
      toast.error("Network error — check your connection");
    } finally {
      setUploading(false);
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const onFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
      e.target.value = "";
    },
    [processFile],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSpreadsheet className="size-5" />
          Upload Meta Ads CSV
        </CardTitle>
        <CardDescription>
          Export daily stats from Meta Ads Manager (Campaign ID, Ad set ID, Ad
          ID, Ad name, Reach, Impressions, Frequency, Amount spent, Messaging
          conversations started, Reporting starts/ends) and drop the file here.
          Campaigns, ad sets, and ads are auto-created if they don't exist yet.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex min-h-[120px] cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-muted-foreground/25 hover:border-primary/50"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <Upload
            className={`size-8 ${dragging ? "text-primary" : "text-muted-foreground"}`}
          />
          {uploading ? (
            <p className="text-sm font-medium">Uploading {fileName}…</p>
          ) : (
            <>
              <p className="text-sm font-medium">
                Drop CSV here or click to browse
              </p>
              <p className="text-muted-foreground text-xs">
                Accepts .csv, .tsv, .txt from Meta Ads Manager
              </p>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.tsv,.txt"
            className="hidden"
            onChange={onFileChange}
          />
        </div>

        {result && (
          <div className="space-y-2 rounded-lg border p-4">
            <div className="flex items-center gap-2">
              {result.skipped === 0 ? (
                <CheckCircle2 className="size-5 text-emerald-600" />
              ) : (
                <AlertCircle className="size-5 text-amber-500" />
              )}
              <span className="text-sm font-medium">
                {result.upserted} of {result.total} rows imported
                {result.skipped > 0 && `, ${result.skipped} skipped`}
              </span>
            </div>

            {result.errors.length > 0 && (
              <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-xs text-destructive">
                {result.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            )}

            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => {
                setResult(null);
                setFileName(null);
              }}
            >
              Upload another
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

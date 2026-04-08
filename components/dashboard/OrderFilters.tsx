"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const STATUSES = ["", "pending", "confirmed", "shipped", "delivered", "cancelled"];

export function OrderFilters({
  currentStatus,
  currentPhone,
  currentFrom,
  currentTo,
}: {
  currentStatus: string;
  currentPhone: string;
  currentFrom: string;
  currentTo: string;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [phone, setPhone] = useState(currentPhone);
  const [from, setFrom] = useState(currentFrom);
  const [to, setTo] = useState(currentTo);

  function apply() {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (phone.trim()) params.set("phone", phone.trim());
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    router.push(`/dashboard/orders${qs ? `?${qs}` : ""}`);
  }

  function clear() {
    setStatus("");
    setPhone("");
    setFrom("");
    setTo("");
    router.push("/dashboard/orders");
  }

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <Label className="text-xs">Status</Label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-9 rounded-lg border px-3 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
        >
          <option value="">All</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Phone</Label>
        <Input
          className="w-40"
          placeholder="Search phone…"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          className="w-36"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          className="w-36"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>
      <Button size="sm" onClick={apply}>
        Filter
      </Button>
      {(status || phone || from || to) && (
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
      )}
    </div>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createStockAdjustmentAction,
  type AdjustmentActionState,
} from "@/app/dashboard/inventory/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type ProductOption = { id: string; name: string; sku: string };
const initial: AdjustmentActionState = {};

export function StockAdjustmentForm({
  products,
}: {
  products: ProductOption[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createStockAdjustmentAction,
    initial
  );
  const [productid, setProductid] = useState("");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (state.ok) {
      setProductid("");
      setQty("");
      setReason("");
      toast.success("Stock adjustment saved");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stock adjustment</CardTitle>
        <CardDescription>
          Use positive qty to add stock, negative to remove.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4 sm:max-w-lg">
          <div className="grid gap-2">
            <Label htmlFor="adj-product">Product</Label>
            <select
              id="adj-product"
              name="productid"
              value={productid}
              onChange={(e) => setProductid(e.target.value)}
              required
              className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 flex h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-[3px] dark:bg-input/30"
            >
              <option value="">Select product…</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku})
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adj-qty">Quantity change</Label>
            <Input
              id="adj-qty"
              name="quantity"
              type="number"
              step={1}
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              required
              placeholder="e.g. +5 or -3"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="adj-reason">Reason</Label>
            <Input
              id="adj-reason"
              name="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              autoComplete="off"
              placeholder="Damaged, returned, count correction…"
            />
          </div>

          <Button type="submit" disabled={pending} className="w-fit">
            {pending ? "Saving…" : "Submit adjustment"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createStockReceiptAction,
  type StockReceiptState,
} from "@/app/dashboard/products/stock-actions";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: StockReceiptState = {};

export function ReceiveStockForm({
  productId,
  onSuccess,
}: {
  productId: string;
  onSuccess?: () => void;
}) {
  const { currencySymbol } = useAppCurrency();
  const router = useRouter();
  const [state, action, pending] = useActionState(
    createStockReceiptAction,
    initial
  );

  useEffect(() => {
    if (state.ok) {
      router.refresh();
      onSuccess?.();
    }
  }, [state.ok, onSuccess, router]);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("Stock recorded");
  }, [state]);

  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="product_id" value={productId} />
      <div className="grid gap-2">
        <Label htmlFor="recv-qty">Quantity received</Label>
        <Input
          id="recv-qty"
          name="qty_received"
          type="number"
          min={1}
          step={1}
          required
        />
      </div>
      <p className="text-muted-foreground text-xs">
        Actual purchase cost per unit (base + shipping + packaging). Roll-up
        updates WAC.
      </p>
      <div className="grid gap-2 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="recv-base">Base / unit ({currencySymbol})</Label>
          <Input
            id="recv-base"
            name="base_cost"
            type="number"
            min={0}
            step="0.01"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="recv-ship">Shipping / unit ({currencySymbol})</Label>
          <Input
            id="recv-ship"
            name="shipping_cost_per_unit"
            type="number"
            min={0}
            step="0.01"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="recv-pack">
            Packaging / unit ({currencySymbol})
          </Label>
          <Input
            id="recv-pack"
            name="packaging_cost_per_unit"
            type="number"
            min={0}
            step="0.01"
          />
        </div>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="recv-date">Received date</Label>
        <Input
          id="recv-date"
          name="received_date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="recv-notes">Notes (optional)</Label>
        <Input id="recv-notes" name="notes" maxLength={2000} />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Saving…" : "Record receipt"}
      </Button>
    </form>
  );
}

"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  receiveStockAction,
  type ReceiveStockState,
} from "@/app/dashboard/products/actions";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initial: ReceiveStockState = {};

export function ReceiveStockForm({ productId }: { productId: string }) {
  const { currencySymbol } = useAppCurrency();
  const router = useRouter();
  const [qty, setQty] = useState("1");
  const [baseCost, setBaseCost] = useState("");
  const [shipping, setShipping] = useState("0");
  const [packaging, setPackaging] = useState("0");
  const [notes, setNotes] = useState("");

  const [state, action, pending] = useActionState(receiveStockAction, initial);

  useEffect(() => {
    if (state.ok) {
      setQty("1");
      setBaseCost("");
      setShipping("0");
      setPackaging("0");
      setNotes("");
      toast.success("Stock received — WAC updated");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <form
      action={(fd) => {
        fd.set("productId", productId);
        fd.set("qty", qty);
        fd.set("base_cost", baseCost);
        fd.set("shipping", shipping);
        fd.set("packaging", packaging);
        fd.set("notes", notes);
        action(fd);
      }}
      className="space-y-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Quantity</Label>
          <Input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Base cost / unit ({currencySymbol})</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={baseCost}
            onChange={(e) => setBaseCost(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label>Shipping / unit ({currencySymbol})</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={shipping}
            onChange={(e) => setShipping(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Packaging / unit ({currencySymbol})</Label>
          <Input
            type="number"
            min={0}
            step="0.01"
            value={packaging}
            onChange={(e) => setPackaging(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Notes (optional)</Label>
        <Input
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. supplier batch ref"
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Receiving…" : "Receive stock"}
      </Button>
    </form>
  );
}

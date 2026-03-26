"use client";

import { useActionState, useEffect, useState } from "react";
import {
  createPurchaseOrderAction,
  receivePurchaseOrderAction,
  type PurchaseActionState,
} from "@/app/dashboard/purchases/actions";
import { useAppCurrency } from "@/components/dashboard/CurrencyProvider";
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
import { Plus, Trash2 } from "lucide-react";

type ProductOption = { id: string; name: string; sku: string };
type LineItem = { productid: string; quantity: number; unitcost: string };

const initial: PurchaseActionState = {};

export function PurchaseFormSection({
  products,
}: {
  products: ProductOption[];
}) {
  const { currency } = useAppCurrency();
  const [items, setItems] = useState<LineItem[]>([
    { productid: "", quantity: 1, unitcost: "" },
  ]);
  const [supplier, setSupplier] = useState("");

  const [createState, createAction, createPending] = useActionState(
    createPurchaseOrderAction,
    initial
  );

  useEffect(() => {
    if (createState.ok) {
      setItems([{ productid: "", quantity: 1, unitcost: "" }]);
      setSupplier("");
    }
  }, [createState.ok]);

  const addLine = () =>
    setItems((prev) => [...prev, { productid: "", quantity: 1, unitcost: "" }]);

  const removeLine = (idx: number) =>
    setItems((prev) => prev.filter((_, i) => i !== idx));

  const updateLine = (idx: number, patch: Partial<LineItem>) =>
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle>New purchase order</CardTitle>
        <CardDescription>
          Costs entered in {currency}. Create, then receive to update stock.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) => {
            const payload = items.map((it) => ({
              productid: it.productid,
              quantity: Number(it.quantity),
              unitcost: Number(it.unitcost),
            }));
            fd.set("items", JSON.stringify(payload));
            fd.set("suppliername", supplier);
            createAction(fd);
          }}
          className="space-y-4"
        >
          <div className="grid gap-2 sm:max-w-xs">
            <Label htmlFor="po-supplier">Supplier name</Label>
            <Input
              id="po-supplier"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              required
              autoComplete="off"
            />
          </div>

          <div className="space-y-3">
            <Label>Line items</Label>
            {items.map((item, idx) => (
              <div
                key={idx}
                className="flex flex-wrap items-end gap-2 rounded-lg border p-3"
              >
                <div className="grid flex-1 gap-1 min-w-[160px]">
                  <span className="text-muted-foreground text-xs">Product</span>
                  <select
                    value={item.productid}
                    onChange={(e) =>
                      updateLine(idx, { productid: e.target.value })
                    }
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
                <div className="grid w-24 gap-1">
                  <span className="text-muted-foreground text-xs">Qty</span>
                  <Input
                    type="number"
                    min={1}
                    step={1}
                    value={item.quantity}
                    onChange={(e) =>
                      updateLine(idx, { quantity: Number(e.target.value) })
                    }
                    required
                  />
                </div>
                <div className="grid w-32 gap-1">
                  <span className="text-muted-foreground text-xs">
                    Unit cost ({currency})
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitcost}
                    onChange={(e) =>
                      updateLine(idx, { unitcost: e.target.value })
                    }
                    required
                  />
                </div>
                {items.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-destructive"
                    onClick={() => removeLine(idx)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
            >
              <Plus className="size-3.5" />
              Add line
            </Button>
          </div>

          {createState.error && (
            <p className="text-destructive text-sm">{createState.error}</p>
          )}
          {createState.ok && (
            <p className="text-emerald-600 text-sm">
              Purchase order created successfully.
            </p>
          )}

          <Button type="submit" disabled={createPending}>
            {createPending ? "Creating…" : "Create purchase order"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ReceiveButton({ poId }: { poId: string }) {
  const [state, action, pending] = useActionState(
    receivePurchaseOrderAction,
    initial
  );

  return (
    <form action={action}>
      <input type="hidden" name="id" value={poId} />
      {state.error && (
        <p className="text-destructive text-xs">{state.error}</p>
      )}
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Receiving…" : "Receive"}
      </Button>
    </form>
  );
}

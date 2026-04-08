"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  createPurchaseOrderAction,
  receivePurchaseOrderAction,
  cancelPurchaseOrderAction,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

type ProductOption = { id: string; name: string; sku: string };
type LineItem = {
  productid: string;
  quantity: number;
  basecost: string;
  shippingcost: string;
  packagingcost: string;
};

const initial: PurchaseActionState = {};

export function PurchaseFormSection({
  products,
}: {
  products: ProductOption[];
}) {
  const { currencySymbol } = useAppCurrency();
  const [items, setItems] = useState<LineItem[]>([
    {
      productid: "",
      quantity: 1,
      basecost: "",
      shippingcost: "",
      packagingcost: "",
    },
  ]);
  const [supplier, setSupplier] = useState("");

  const [createState, createAction, createPending] = useActionState(
    createPurchaseOrderAction,
    initial
  );

  useEffect(() => {
    if (createState.ok) {
      setItems([
        {
          productid: "",
          quantity: 1,
          basecost: "",
          shippingcost: "",
          packagingcost: "",
        },
      ]);
      setSupplier("");
    }
  }, [createState.ok]);

  useEffect(() => {
    if (createState.error) toast.error(createState.error);
    else if (createState.ok) toast.success("Purchase order created");
  }, [createState]);

  const addLine = () =>
    setItems((prev) => [
      ...prev,
      {
        productid: "",
        quantity: 1,
        basecost: "",
        shippingcost: "",
        packagingcost: "",
      },
    ]);

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
          Actual landed unit cost per line: base + shipping + packaging (in{" "}
          {currencySymbol}). Receive applies these to WAC. Product planning
          fields are separate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          action={(fd) => {
            const payload = items.map((it) => ({
              productid: it.productid,
              quantity: Number(it.quantity),
              base_cost: Number(it.basecost) || 0,
              shipping_cost_per_unit: Number(it.shippingcost) || 0,
              packaging_cost_per_unit: Number(it.packagingcost) || 0,
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
                className="flex flex-col gap-3 rounded-lg border p-3 md:flex-row md:flex-wrap md:items-end"
              >
                <div className="grid min-w-[180px] flex-1 gap-1">
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
                <div className="grid w-full gap-1 sm:w-24">
                  <span className="text-muted-foreground text-xs">Qty</span>
                  <Input
                    type="number"
                    min={1}
                    step="1"
                    value={item.quantity}
                    onChange={(e) =>
                      updateLine(idx, {
                        quantity: Math.max(1, Math.round(Number(e.target.value))),
                      })
                    }
                    required
                  />
                </div>
                <div className="grid w-full min-w-[100px] flex-1 gap-1 sm:max-w-[140px]">
                  <span className="text-muted-foreground text-xs">
                    Base / u ({currencySymbol})
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.basecost}
                    onChange={(e) =>
                      updateLine(idx, { basecost: e.target.value })
                    }
                  />
                </div>
                <div className="grid w-full min-w-[100px] flex-1 gap-1 sm:max-w-[140px]">
                  <span className="text-muted-foreground text-xs">
                    Ship / u ({currencySymbol})
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.shippingcost}
                    onChange={(e) =>
                      updateLine(idx, { shippingcost: e.target.value })
                    }
                  />
                </div>
                <div className="grid w-full min-w-[100px] flex-1 gap-1 sm:max-w-[140px]">
                  <span className="text-muted-foreground text-xs">
                    Pack / u ({currencySymbol})
                  </span>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.packagingcost}
                    onChange={(e) =>
                      updateLine(idx, { packagingcost: e.target.value })
                    }
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

          <Button type="submit" disabled={createPending}>
            {createPending ? "Creating…" : "Create purchase order"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function ReceiveButton({ poId }: { poId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    receivePurchaseOrderAction,
    initial
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("Purchase received");
  }, [state]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
      >
        Receive
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>Receive this purchase order?</DialogTitle>
            <DialogDescription>
              Receiving will update inventory and WAC for all line items.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form action={action}>
            <input type="hidden" name="id" value={poId} />
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Receiving…" : "Confirm receive"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

export function CancelPOButton({ poId }: { poId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(
    cancelPurchaseOrderAction,
    initial
  );

  useEffect(() => {
    if (state.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state.ok, router]);

  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.ok) toast.success("Purchase order cancelled");
  }, [state]);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        Cancel
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent showClose>
          <DialogHeader>
            <DialogTitle>Cancel this purchase order?</DialogTitle>
            <DialogDescription>
              The PO will be marked as cancelled. No stock changes will be
              made. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <form action={action}>
            <input type="hidden" name="id" value={poId} />
            <DialogFooter className="gap-2 sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Keep PO
              </Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Cancelling…" : "Confirm cancel"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Trash2 } from "lucide-react";
import {
  cancelOrderAction,
  updateOrderDetailsAction,
  type OrderDashboardActionState,
} from "@/app/dashboard/orders/actions";
import { AFGHANISTAN_PROVINCES } from "@/lib/afghanistanProvinces";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const initial: OrderDashboardActionState = {};

const EDITABLE_STATUSES = [
  "pending",
  "confirmed",
  "shipped",
  "delivered",
] as const;

export function OrderDetailToolbar({
  orderId,
  status: initialStatus,
  deliveryaddress: initialAddress,
  trackingnumber: initialTracking,
}: {
  orderId: string;
  status: string;
  deliveryaddress: string;
  trackingnumber: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [deliveryaddress, setDeliveryaddress] = useState(initialAddress);
  const [trackingnumber, setTrackingnumber] = useState(
    initialTracking ?? "",
  );
  const [cancelOpen, setCancelOpen] = useState(false);

  const provinceOptions = useMemo(() => {
    if (AFGHANISTAN_PROVINCES.includes(initialAddress)) {
      return AFGHANISTAN_PROVINCES;
    }
    return [initialAddress, ...AFGHANISTAN_PROVINCES];
  }, [initialAddress]);

  const [updateState, updateAction, updatePending] = useActionState(
    updateOrderDetailsAction,
    initial,
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelOrderAction,
    initial,
  );

  useEffect(() => {
    setStatus(initialStatus);
    setDeliveryaddress(initialAddress);
    setTrackingnumber(initialTracking ?? "");
  }, [initialStatus, initialAddress, initialTracking]);

  useEffect(() => {
    if (updateState.error) toast.error(updateState.error);
    else if (updateState.ok) {
      toast.success("Order updated");
      router.refresh();
    }
  }, [updateState, router]);

  useEffect(() => {
    if (cancelState.error) toast.error(cancelState.error);
    else if (cancelState.ok) {
      toast.success("Order cancelled");
      setCancelOpen(false);
      router.refresh();
    }
  }, [cancelState, router]);

  const isCancelled = initialStatus === "cancelled";
  const canCancel =
    !isCancelled &&
    (initialStatus === "pending" || initialStatus === "confirmed");

  const statusForSubmit = EDITABLE_STATUSES.includes(
    status as (typeof EDITABLE_STATUSES)[number],
  )
    ? status
    : "pending";

  async function copyId() {
    try {
      await navigator.clipboard.writeText(orderId);
      toast.success("Order ID copied");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Order ID
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <code className="bg-muted max-w-full truncate rounded-md border px-2 py-1 font-mono text-xs">
              {orderId}
            </code>
            <Button type="button" variant="outline" size="sm" onClick={copyId}>
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>
        </div>

        {canCancel ? (
          <>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="shrink-0 gap-1.5 self-start sm:self-center"
              onClick={() => setCancelOpen(true)}
            >
              <Trash2 className="size-3.5" />
              Cancel order
            </Button>
            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
              <DialogContent showClose>
                <DialogHeader>
                  <DialogTitle>Cancel this order?</DialogTitle>
                  <DialogDescription>
                    Only pending and confirmed orders can be cancelled. Stock
                    is not returned to inventory automatically.
                  </DialogDescription>
                </DialogHeader>
                <form action={cancelAction}>
                  <input type="hidden" name="id" value={orderId} />
                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setCancelOpen(false)}
                    >
                      Keep order
                    </Button>
                    <Button
                      type="submit"
                      variant="destructive"
                      disabled={cancelPending}
                    >
                      {cancelPending ? "Cancelling…" : "Confirm cancel"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        ) : null}
      </div>

      {!isCancelled ? (
        <form action={updateAction} className="grid max-w-3xl gap-4 border-t pt-6">
          <input type="hidden" name="id" value={orderId} />
          <input type="hidden" name="status" value={statusForSubmit} />
          <input
            type="hidden"
            name="deliveryaddress"
            value={deliveryaddress}
          />
          <p className="text-sm font-medium">Update delivery and status</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="ord-status">Status</Label>
              <Select value={statusForSubmit} onValueChange={setStatus}>
                <SelectTrigger id="ord-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EDITABLE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ord-province">Delivery province</Label>
              <Select
                value={deliveryaddress}
                onValueChange={setDeliveryaddress}
              >
                <SelectTrigger id="ord-province">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-56">
                  {provinceOptions.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 sm:col-span-2 lg:col-span-1">
              <Label htmlFor="ord-tracking">Tracking (optional)</Label>
              <Input
                id="ord-tracking"
                name="trackingnumber"
                value={trackingnumber}
                onChange={(e) => setTrackingnumber(e.target.value)}
                placeholder="Carrier reference"
                autoComplete="off"
              />
            </div>
          </div>
          <Button type="submit" disabled={updatePending} className="w-fit">
            {updatePending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      ) : null}
    </div>
  );
}

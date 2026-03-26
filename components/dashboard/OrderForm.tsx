"use client";

import { useEffect, useRef, useState } from "react";
import type { OrderItemInput } from "@/types";
import { roundMoney2 } from "@/lib/amountConversion";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface OrderFormProps {
  products: {
    id: string;
    name: string;
    sku: string;
    defaultsaleprice: number;
  }[];
}

interface ItemRow extends OrderItemInput {
  key: number;
}

export function OrderForm({ products }: OrderFormProps) {
  const { currency, displayToBase, baseToDisplay, convertDisplay } =
    useAppCurrency();
  const prevCurrencyRef = useRef(currency);
  const [phone, setPhone] = useState("");
  const [clickId, setClickId] = useState("");
  const [adId, setAdId] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("0");
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<ItemRow[]>([
    { key: 0, productid: "", quantity: 1, saleprice: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  useEffect(() => {
    const prev = prevCurrencyRef.current;
    if (prev === currency) return;
    setDeliveryCost((d) =>
      String(
        roundMoney2(convertDisplay(parseFloat(d) || 0, prev, currency))
      )
    );
    setItems((rows) =>
      rows.map((row) => ({
        ...row,
        saleprice: roundMoney2(convertDisplay(row.saleprice, prev, currency)),
      }))
    );
    prevCurrencyRef.current = currency;
  }, [currency, convertDisplay]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { key: Date.now(), productid: "", quantity: 1, saleprice: 0 },
    ]);
  }

  function removeItem(key: number) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  function updateItem(
    key: number,
    field: keyof OrderItemInput,
    value: string | number
  ) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.key !== key) return i;
        if (field === "productid") {
          const product = products.find((p) => p.id === value);
          return {
            ...i,
            productid: value as string,
            saleprice: roundMoney2(
              baseToDisplay(product?.defaultsaleprice ?? 0)
            ),
          };
        }
        return { ...i, [field]: field === "quantity" || field === "saleprice" ? Number(value) : value };
      })
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (items.some((i) => !i.productid)) {
      setResult({ ok: false, msg: "Select a product for every line." });
      return;
    }
    setSubmitting(true);
    setResult(null);

    const res = await fetch("/api/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        phone,
        items: items.map(({ productid, quantity, saleprice }) => ({
          productid,
          quantity,
          saleprice: displayToBase(Number(saleprice) || 0),
        })),
        deliverycost: displayToBase(parseFloat(deliveryCost) || 0),
        clickid: clickId.trim() || undefined,
        adid: adId.trim() || undefined,
        status,
      }),
    });

    setSubmitting(false);
    const j = await res.json().catch(() => ({}));
    setResult(
      res.ok
        ? { ok: true, msg: "Order created and attributed." }
        : {
            ok: false,
            msg:
              typeof j.error === "string"
                ? j.error
                : "Failed to create order. Check inputs and try again.",
          }
    );
  }

  return (
    <Card className="max-w-2xl shadow-sm">
      <CardHeader>
        <CardTitle>Order details</CardTitle>
        <CardDescription>
          Prices and delivery are in your sidebar currency; they are converted to{" "}
          <code className="text-xs">AMOUNT_BASE_CURRENCY</code> before save. COGS
          comes from the latest <code className="text-xs">productcosts</code> row.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Customer
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  required
                  type="tel"
                  placeholder="+1234567890"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="clickid">Click ID (from WhatsApp)</Label>
                <Input
                  id="clickid"
                  className="font-mono text-sm"
                  placeholder="CK-LY2K4F-X7QR"
                  value={clickId}
                  onChange={(e) => setClickId(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="adid">Ad UUID (optional manual override)</Label>
              <Input
                id="adid"
                className="font-mono text-xs"
                placeholder="00000000-0000-0000-0000-000000000000"
                value={adId}
                onChange={(e) => setAdId(e.target.value)}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              Items
            </h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.key} className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[180px] flex-1 space-y-2">
                    <Label>Product</Label>
                    <Select
                      value={item.productid || undefined}
                      onValueChange={(v) => updateItem(item.key, "productid", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-20 space-y-2">
                    <Label>Qty</Label>
                    <Input
                      required
                      type="number"
                      min={1}
                      value={item.quantity}
                      onChange={(e) =>
                        updateItem(item.key, "quantity", e.target.value)
                      }
                    />
                  </div>
                  <div className="w-28 space-y-2">
                    <Label>Price ({currency})</Label>
                    <Input
                      required
                      type="number"
                      step="0.01"
                      min={0}
                      value={item.saleprice}
                      onChange={(e) =>
                        updateItem(item.key, "saleprice", e.target.value)
                      }
                    />
                  </div>
                  {items.length > 1 ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive mb-0.5"
                      onClick={() => removeItem(item.key)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
            <Button type="button" variant="outline" size="sm" onClick={addItem}>
              Add item
            </Button>
          </section>

          <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="delivery">Delivery cost ({currency})</Label>
              <Input
                id="delivery"
                type="number"
                step="0.01"
                min={0}
                value={deliveryCost}
                onChange={(e) => setDeliveryCost(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "pending",
                      "confirmed",
                      "shipped",
                      "delivered",
                      "cancelled",
                    ] as const
                  ).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          {result ? (
            <p
              className={
                result.ok
                  ? "rounded-lg bg-green-50 px-4 py-2 text-sm text-green-800 dark:bg-green-950 dark:text-green-200"
                  : "rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive"
              }
              role="status"
            >
              {result.msg}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creating…" : "Create order"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

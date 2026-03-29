"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { OrderItemInput } from "@/types";
import { roundMoney2 } from "@/lib/amountConversion";
import {
  AFGHANISTAN_PROVINCES,
  DEFAULT_AFGHAN_PROVINCE,
} from "@/lib/afghanistanProvinces";
import {
  COUNTRY_DIAL_OPTIONS,
  DEFAULT_COUNTRY_ID,
  combineInternationalPhone,
  formatInternationalPhoneForDisplay,
} from "@/lib/countryDialCodes";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AD_SELECT_NONE = "__no_ad__";

function isKabulProvince(province: string): boolean {
  return province.trim().toLowerCase() === "kabul";
}

interface OrderFormProps {
  products: {
    id: string;
    name: string;
    sku: string;
    defaultsaleprice: number;
  }[];
  ads: { id: string; label: string }[];
}

interface ItemRow extends OrderItemInput {
  key: number;
}

export function OrderForm({ products, ads }: OrderFormProps) {
  const router = useRouter();
  const {
    currency,
    currencySymbol,
    baseToDisplay,
    convertDisplay,
    formatMoney,
  } = useAppCurrency();
  const prevCurrencyRef = useRef(currency);
  const [countryId, setCountryId] = useState(DEFAULT_COUNTRY_ID);
  const countryDial =
    COUNTRY_DIAL_OPTIONS.find((c) => c.id === countryId)?.dial ?? "+93";
  const [phoneLocal, setPhoneLocal] = useState("");
  const [clickId, setClickId] = useState("");
  const [selectedAdId, setSelectedAdId] = useState<string>(AD_SELECT_NONE);
  const [deliveryProvince, setDeliveryProvince] = useState(
    DEFAULT_AFGHAN_PROVINCE,
  );
  const [trackingNumber, setTrackingNumber] = useState("");
  const [deliveryCost, setDeliveryCost] = useState("0");
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState<ItemRow[]>([
    { key: 0, productid: "", quantity: 1, saleprice: 0 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);

  const phoneDisplayReview = formatInternationalPhoneForDisplay(
    countryDial,
    phoneLocal,
  );
  const showTrackingField = !isKabulProvince(deliveryProvince);

  const selectedAdLabel =
    selectedAdId === AD_SELECT_NONE
      ? "None (auto attribution)"
      : (ads.find((a) => a.id === selectedAdId)?.label ?? "—");

  useEffect(() => {
    const prev = prevCurrencyRef.current;
    if (prev === currency) return;
    setDeliveryCost((d) =>
      String(
        roundMoney2(convertDisplay(parseFloat(d) || 0, prev, currency)),
      ),
    );
    setItems((rows) =>
      rows.map((row) => ({
        ...row,
        saleprice: roundMoney2(convertDisplay(row.saleprice, prev, currency)),
      })),
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
    value: string | number,
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
              baseToDisplay(product?.defaultsaleprice ?? 0),
            ),
          };
        }
        return {
          ...i,
          [field]:
            field === "quantity" || field === "saleprice"
              ? Number(value)
              : value,
        };
      }),
    );
  }

  function validateForSubmit(): string | null {
    if (!phoneLocal.replace(/\D/g, "").length) {
      return "Enter a phone number.";
    }
    const combined = combineInternationalPhone(countryDial, phoneLocal);
    if (!/^\+?\d[\d\s\-()]{4,}$/.test(combined)) {
      return "Phone number looks invalid.";
    }
    if (items.some((i) => !i.productid)) {
      return "Select a product for every line.";
    }
    if (!deliveryProvince.trim()) {
      return "Select a delivery province.";
    }
    return null;
  }

  function openReview() {
    const err = validateForSubmit();
    if (err) {
      toast.error(err);
      return;
    }
    setReviewOpen(true);
  }

  async function submitOrder() {
    const err = validateForSubmit();
    if (err) {
      toast.error(err);
      setReviewOpen(false);
      return;
    }

    setSubmitting(true);

    const phone = combineInternationalPhone(countryDial, phoneLocal);
    const trackingPayload =
      showTrackingField && trackingNumber.trim().length > 0
        ? trackingNumber.trim()
        : undefined;

    const run = (async () => {
      try {
        const res = await fetch("/api/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            phone,
            items: items.map(({ productid, quantity, saleprice }) => ({
              productid,
              quantity,
              saleprice: Number(saleprice) || 0,
            })),
            deliverycost: parseFloat(deliveryCost) || 0,
            clickid: clickId.trim() || undefined,
            adid:
              selectedAdId !== AD_SELECT_NONE ? selectedAdId : undefined,
            deliveryaddress: deliveryProvince.trim(),
            trackingnumber: trackingPayload,
            status,
          }),
        });

        const j = (await res.json().catch(() => ({}))) as {
          error?: string;
          order?: { id: string };
        };

        if (!res.ok) {
          throw new Error(
            typeof j.error === "string"
              ? j.error
              : "Failed to create order. Check inputs and try again.",
          );
        }
        const orderId = j.order?.id;
        if (!orderId) {
          throw new Error(
            "Order was created but the response was incomplete.",
          );
        }
        return orderId;
      } finally {
        setSubmitting(false);
      }
    })();

    toast.promise(run, {
      loading: "Creating order…",
      success: (orderId) => {
        setReviewOpen(false);
        router.push(`/dashboard/orders/${orderId}`);
        return "Order created";
      },
      error: (e) =>
        e instanceof Error ? e.message : "Failed to create order.",
    });
  }

  return (
    <>
      <Card className="max-w-2xl shadow-sm">
        <CardHeader>
          <CardTitle>Order details</CardTitle>
          <CardDescription>
            Enter prices in your sidebar currency. The server converts them to{" "}
            <code className="text-xs">AMOUNT_BASE_CURRENCY</code> before writing
            to the database (only book currency is stored). COGS uses WAC at
            order time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-8">
            {/* 1. Customer + attribution (after phone) */}
            <section className="space-y-3">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Customer
              </h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="country">Country / dial code</Label>
                  <Select value={countryId} onValueChange={setCountryId}>
                    <SelectTrigger id="country" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {COUNTRY_DIAL_OPTIONS.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone-local">Phone number</Label>
                  <Input
                    id="phone-local"
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel-national"
                    placeholder="701234567"
                    value={phoneLocal}
                    onChange={(e) => setPhoneLocal(e.target.value)}
                  />
                  <p className="text-muted-foreground text-xs">
                    Formatted:{" "}
                    <span className="text-foreground font-mono text-sm leading-relaxed tracking-wide">
                      {phoneLocal.replace(/\D/g, "")
                        ? phoneDisplayReview
                        : "—"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="space-y-3 border-t border-border pt-4">
                <div className="space-y-2">
                  <Label>Attributed ad</Label>
                  <Select value={selectedAdId} onValueChange={setSelectedAdId}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select ad" />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      <SelectItem value={AD_SELECT_NONE}>
                        None — use click ID or auto attribution
                      </SelectItem>
                      {ads.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-muted-foreground text-xs">
                    Meta ad and campaign when not resolved from the click ID.
                  </p>
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
            </section>

            {/* 2. Line items */}
            <section className="space-y-3">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Products
              </h3>
              <div className="space-y-3">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="flex flex-wrap items-end gap-3"
                  >
                    <div className="min-w-[180px] flex-1 space-y-2">
                      <Label>Product</Label>
                      <Select
                        value={item.productid || undefined}
                        onValueChange={(v) =>
                          updateItem(item.key, "productid", v)
                        }
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
                      <Label>
                        Price{" "}
                        <span className="text-muted-foreground font-normal tabular-nums">
                          ({currencySymbol})
                        </span>
                      </Label>
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

            {/* 3. Delivery cost & order status */}
            <section className="grid grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="delivery">
                  Delivery cost{" "}
                  <span className="text-muted-foreground font-normal tabular-nums">
                    ({currencySymbol})
                  </span>
                </Label>
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
                <Label htmlFor="status">Order status</Label>
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

            {/* 4. Delivery address (last) */}
            <section className="space-y-3 border-t pt-6">
              <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                Delivery address
              </h3>
              <div className="space-y-2">
                <Label htmlFor="province">Province (Afghanistan)</Label>
                <Select
                  value={deliveryProvince}
                  onValueChange={(v) => {
                    setDeliveryProvince(v);
                    if (isKabulProvince(v)) setTrackingNumber("");
                  }}
                >
                  <SelectTrigger id="province" className="w-full">
                    <SelectValue placeholder="Select province" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {AFGHANISTAN_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-muted-foreground text-xs">
                  Defaults to Kabul. Tracking appears only when province is not
                  Kabul.
                </p>
              </div>
              {showTrackingField ? (
                <div className="space-y-2">
                  <Label htmlFor="tracking">
                    Carrier tracking number{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="tracking"
                    name="shipping_tracking"
                    autoComplete="off"
                    placeholder="AWB, courier ref, or tracking ID"
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                  />
                </div>
              ) : null}
            </section>

            <Button
              type="button"
              className="w-full"
              disabled={submitting}
              onClick={() => void openReview()}
            >
              Create order
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Review order</DialogTitle>
            <DialogDescription>
              Confirm details before submitting. Amounts are in your display
              currency; the server stores book currency.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Phone</span>
              <span className="text-right font-mono text-sm font-medium leading-relaxed tracking-wide">
                {phoneDisplayReview}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3">
              <span className="text-muted-foreground">Attributed ad</span>
              <span className="max-w-[60%] text-right text-xs leading-snug">
                {selectedAdLabel}
              </span>
            </div>
            {clickId.trim() ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Click ID</span>
                <span className="max-w-[60%] text-right font-mono text-xs">
                  {clickId.trim()}
                </span>
              </div>
            ) : (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Click ID</span>
                <span className="max-w-[60%] text-right text-xs text-muted-foreground">
                  —
                </span>
              </div>
            )}
            <div className="border-t pt-3">
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">
                Products
              </p>
              <ul className="space-y-2">
                {items.map((item) => {
                  const p = products.find((x) => x.id === item.productid);
                  return (
                    <li
                      key={item.key}
                      className="flex justify-between gap-2 text-xs"
                    >
                      <span className="min-w-0 flex-1 font-medium">
                        {p?.name ?? "—"} × {item.quantity}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {formatMoney(
                          (Number(item.saleprice) || 0) * item.quantity,
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3">
              <span className="text-muted-foreground">Delivery fee</span>
              <span className="tabular-nums font-medium">
                {formatMoney(parseFloat(deliveryCost) || 0)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Status</span>
              <span className="capitalize">{status}</span>
            </div>
            <div className="flex justify-between gap-4 border-t pt-3">
              <span className="text-muted-foreground">Province</span>
              <span className="max-w-[60%] text-right text-xs font-medium leading-snug">
                {deliveryProvince}
              </span>
            </div>
            {showTrackingField ? (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tracking</span>
                <span className="max-w-[60%] text-right font-mono text-xs break-all">
                  {trackingNumber.trim() || "— (none)"}
                </span>
              </div>
            ) : (
              <div className="flex justify-between gap-4">
                <span className="text-muted-foreground">Tracking</span>
                <span className="max-w-[60%] text-right text-xs text-muted-foreground">
                  Not used (Kabul)
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setReviewOpen(false)}
              disabled={submitting}
            >
              Back to edit
            </Button>
            <Button
              type="button"
              onClick={() => void submitOrder()}
              disabled={submitting}
            >
              {submitting ? "Submitting…" : "Confirm & submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

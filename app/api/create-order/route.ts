import { NextRequest, NextResponse } from "next/server";
import { getAppUserIdForAuthUser, getSessionUser } from "@/lib/authApi";
import { resolveAttribution } from "@/lib/attribution";
import { sendCAPIEvent } from "@/lib/meta/capi";
import { normalizePhoneE164 } from "@/lib/phoneNormalize";
import { createServiceClient } from "@/lib/supabaseServer";
import { parseUuid } from "@/lib/uuid";
import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { userDisplayAmountToBase } from "@/lib/formMoneyServer";
import { CreateOrderSchema } from "@/lib/validation";
import { allowNegativeStock } from "@/lib/inventoryPolicy";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const raw = await req.json();
    const parsed = CreateOrderSchema.safeParse(raw);
    if (!parsed.success) {
      const msg = parsed.error.issues.map((i) => i.message).join("; ");
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const body = parsed.data;
    const phoneStored = normalizePhoneE164(body.phone);

    // Amounts in the JSON body are in the signed-in user’s display currency
    // (cookies: app_currency + FX snapshot). Persist only AMOUNT_BASE_CURRENCY.
    const deliverycostBase = await userDisplayAmountToBase(body.deliverycost);
    const itemsForDb = await Promise.all(
      body.items.map(async (i) => ({
        productid: i.productid,
        quantity: i.quantity,
        saleprice: await userDisplayAmountToBase(i.saleprice),
      }))
    );

    const supabase = createServiceClient();
    const now = new Date();
    const createdby = await getAppUserIdForAuthUser(user.id);

    const productIds = body.items.map((i) => i.productid);
    const { data: validProducts } = await supabase
      .from("products")
      .select("id")
      .in("id", productIds)
      .eq("isactive", true);

    const validIds = new Set((validProducts ?? []).map((p) => p.id));
    const invalid = productIds.filter((id) => !validIds.has(id));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid or inactive product(s): ${invalid.join(", ")}` },
        { status: 400 }
      );
    }

    const adidOverride = parseUuid(body.adid?.trim() ?? null);

    const attribution = await resolveAttribution({
      phone: phoneStored,
      items: body.items,
      deliverycost: deliverycostBase,
      clickid: body.clickid,
      adid: adidOverride ?? undefined,
      ordertime: now,
    });

    const tracking =
      body.trackingnumber?.trim() ||
      null;

    const pItems = itemsForDb.map((i) => ({
      productid: i.productid,
      quantity: i.quantity,
      saleprice: i.saleprice,
    }));

    const { data: orderId, error: orderError } = await supabase.rpc(
      "create_order_and_apply_items",
      {
        p_phone: phoneStored,
        p_clickid: attribution.clickid,
        p_adid: attribution.adid,
        p_adsetid: attribution.adsetid,
        p_campaignid: attribution.campaignid,
        p_deliveryaddress: body.deliveryaddress.trim(),
        p_trackingnumber: tracking,
        p_deliverycost: deliverycostBase,
        p_status: body.status,
        p_attributionmethod: attribution.method,
        p_confidencescore: attribution.confidence,
        p_allocatedadspend: 0,
        p_createdby: createdby,
        p_items: pItems,
        p_allow_negative: allowNegativeStock(),
      },
    );

    if (orderError || !orderId) {
      const msg = orderError?.message ?? "";
      if (msg.includes("INSUFFICIENT_STOCK")) {
        return NextResponse.json(
          { error: "Insufficient stock for one or more products." },
          { status: 400 }
        );
      }
      throw orderError ?? new Error("No order returned");
    }

    if (attribution.campaignid) {
      const { error: allocErr } = await supabase.rpc(
        "reallocate_campaign_day_ad_spend",
        {
          p_campaign_id: attribution.campaignid,
          p_date: now.toISOString().split("T")[0],
        },
      );
      if (allocErr) console.warn("ad-spend allocation:", allocErr.message);
    }

    const { data: order, error: fetchErr } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchErr || !order) throw fetchErr ?? new Error("Order fetch failed");

    const revenue = itemsForDb.reduce(
      (sum, i) => sum + i.saleprice * i.quantity,
      0
    );

    await supabase.from("conversionevents").insert({
      orderid: order.id,
      eventtype: "Purchase",
      value: revenue,
      status: "pending",
    });

    void firePurchaseCAPI(order.id).catch(console.error);

    return NextResponse.json({ order }, { status: 201 });
  } catch (err) {
    console.error("create-order error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}

async function firePurchaseCAPI(orderId: string) {
  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("conversionevents")
    .select("status")
    .eq("orderid", orderId)
    .eq("eventtype", "Purchase")
    .eq("status", "sent")
    .maybeSingle();

  if (existing?.status === "sent") return;

  const { data: order } = await supabase
    .from("orders")
    .select(
      "id, phone, createdat, clickid, orderitems(productid, saleprice, quantity)"
    )
    .eq("id", orderId)
    .single();

  if (!order) return;

  type OI = { productid: string; saleprice: number; quantity: number };
  const oi = order.orderitems as OI[] | null;
  const revenue =
    oi?.reduce((s, i) => s + i.saleprice * i.quantity, 0) ?? 0;

  let fbclid: string | null = null;
  let ipaddress: string | null = null;
  let useragent: string | null = null;

  if (order.clickid) {
    const { data: click } = await supabase
      .from("clicks")
      .select("fbclid, ipaddress, useragent")
      .eq("clickid", order.clickid)
      .maybeSingle();
    fbclid = click?.fbclid ?? null;
    ipaddress = click?.ipaddress ?? null;
    useragent = click?.useragent ?? null;
  }

  const { ok, response } = await sendCAPIEvent({
    eventName: "Purchase",
    eventId: orderId,
    orderId,
    eventTime: Math.floor(Date.now() / 1000),
    value: revenue,
    currency: getAmountBaseCurrency(),
    fbclid,
    ipAddress: ipaddress,
    userAgent: useragent,
    phone: normalizePhoneE164(order.phone),
    contentIds: oi?.map((i) => i.productid) ?? [],
    clickId: order.clickid ?? null,
  });

  await supabase
    .from("conversionevents")
    .update({
      status: ok ? "sent" : "failed",
      sentat: new Date().toISOString(),
      metaresponse:
        response === undefined ? null : JSON.stringify(response),
    })
    .eq("orderid", orderId)
    .eq("eventtype", "Purchase")
    .in("status", ["pending", "failed"]);

  if (ok) {
    await supabase
      .from("orders")
      .update({ meta_sent: true })
      .eq("id", orderId);
  }
}

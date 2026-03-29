import { NextRequest, NextResponse } from "next/server";
import { getAppUserIdForAuthUser, getSessionUser } from "@/lib/authApi";
import { resolveAttribution } from "@/lib/attribution";
import { sendCAPIEvent } from "@/lib/metaConversions";
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
      phone: body.phone,
      items: body.items,
      deliverycost: deliverycostBase,
      clickid: body.clickid,
      adid: adidOverride ?? undefined,
      ordertime: now,
    });

    const tracking =
      body.trackingnumber?.trim() ||
      null;

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        phone: body.phone.trim(),
        clickid: attribution.clickid,
        adid: attribution.adid,
        campaignid: attribution.campaignid,
        deliveryaddress: body.deliveryaddress.trim(),
        trackingnumber: tracking,
        deliverycost: deliverycostBase,
        status: body.status,
        attributionmethod: attribution.method,
        confidencescore: attribution.confidence,
        allocatedadspend: 0,
        createdby,
      })
      .select("*")
      .single();

    if (orderError || !order) throw orderError ?? new Error("No order returned");

    const pItems = itemsForDb.map((i) => ({
      productid: i.productid,
      quantity: i.quantity,
      saleprice: i.saleprice,
    }));

    const { error: applyErr } = await supabase.rpc(
      "apply_order_sales_and_items",
      {
        p_order_id: order.id,
        p_items: pItems,
        p_allow_negative: allowNegativeStock(),
      }
    );

    if (applyErr) {
      await supabase.from("orders").delete().eq("id", order.id);
      const msg = applyErr.message ?? "";
      if (msg.includes("INSUFFICIENT_STOCK")) {
        return NextResponse.json(
          { error: "Insufficient stock for one or more products." },
          { status: 400 }
        );
      }
      throw applyErr;
    }

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
    eventTime: Math.floor(new Date(order.createdat).getTime() / 1000),
    value: revenue,
    currency: getAmountBaseCurrency(),
    fbclid,
    ipAddress: ipaddress,
    userAgent: useragent,
    phone: order.phone,
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
    .eq("status", "pending");
}

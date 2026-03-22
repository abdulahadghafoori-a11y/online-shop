import { NextRequest, NextResponse } from "next/server";
import { getAppUserIdForAuthUser, getSessionUser } from "@/lib/authApi";
import { resolveAttribution } from "@/lib/attribution";
import { sendCAPIEvent } from "@/lib/metaConversions";
import { createServiceClient } from "@/lib/supabaseServer";
import { parseUuid } from "@/lib/uuid";
import type { CreateOrderPayload } from "@/types";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as CreateOrderPayload;
    if (!body.phone?.trim()) {
      return NextResponse.json({ error: "Phone required" }, { status: 400 });
    }
    if (!body.items?.length) {
      return NextResponse.json({ error: "At least one line item required" }, { status: 400 });
    }

    const supabase = createServiceClient();
    const now = new Date();
    const createdby = await getAppUserIdForAuthUser(user.id);

    const adidOverride = parseUuid(body.adid?.trim() ?? null);

    const attribution = await resolveAttribution({
      ...body,
      adid: adidOverride ?? undefined,
      ordertime: now,
    });

    const itemsWithCost = await Promise.all(
      body.items.map(async (item) => {
        const { data: costRow } = await supabase
          .from("productcosts")
          .select("unitcost")
          .eq("productid", item.productid)
          .lte("createdat", now.toISOString())
          .order("createdat", { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...item,
          unitcost: costRow?.unitcost ?? 0,
        };
      })
    );

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        phone: body.phone.trim(),
        clickid: attribution.clickid,
        adid: attribution.adid,
        campaignid: attribution.campaignid,
        deliverycost: body.deliverycost ?? 0,
        status: body.status ?? "pending",
        attributionmethod: attribution.method,
        confidencescore: attribution.confidence,
        allocatedadspend: 0,
        createdby,
      })
      .select("*")
      .single();

    if (orderError || !order) throw orderError ?? new Error("No order returned");

    const { error: itemsError } = await supabase.from("orderitems").insert(
      itemsWithCost.map((item) => ({
        orderid: order.id,
        productid: item.productid,
        quantity: item.quantity,
        saleprice: item.saleprice,
        unitcost: item.unitcost,
      }))
    );

    if (itemsError) throw itemsError;

    const { error: invError } = await supabase.from("inventorytransactions").insert(
      itemsWithCost.map((item) => ({
        productid: item.productid,
        type: "sale" as const,
        quantity: -item.quantity,
        unitcost: item.unitcost,
        referenceid: order.id,
      }))
    );

    if (invError) throw invError;

    const revenue = itemsWithCost.reduce(
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
    eventTime: Math.floor(new Date(order.createdat).getTime() / 1000),
    value: revenue,
    currency: process.env.CURRENCY ?? "USD",
    fbclid,
    ipAddress: ipaddress,
    userAgent: useragent,
    phone: order.phone,
    contentIds: oi?.map((i) => i.productid) ?? [],
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

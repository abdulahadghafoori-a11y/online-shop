import { sha256 } from "./hash";

type CAPIEventName = "InitiateCheckout" | "Purchase";

export interface CAPIPayload {
  eventName: CAPIEventName;
  eventId: string;
  eventTime: number;
  value?: number;
  currency?: string;
  fbclid?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  phone?: string | null;
  contentIds?: string[];
}

/** Meta Graph Conversions API — snake_case keys per Graph API. */
export async function sendCAPIEvent(payload: CAPIPayload): Promise<{
  ok: boolean;
  response?: unknown;
}> {
  const pixelId = process.env.META_PIXEL_ID ?? process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const token = process.env.META_CONVERSIONS_API_TOKEN;
  const version = process.env.META_API_VERSION ?? "v21.0";

  if (!pixelId || !token) {
    console.warn("CAPI: missing META_PIXEL_ID or META_CONVERSIONS_API_TOKEN");
    return { ok: false };
  }

  const user_data: Record<string, unknown> = {};

  if (payload.ipAddress) user_data.client_ip_address = payload.ipAddress;
  if (payload.userAgent) user_data.client_user_agent = payload.userAgent;
  if (payload.fbclid) {
    user_data.fbc = `fb.1.${payload.eventTime * 1000}.${payload.fbclid}`;
  }
  if (payload.phone) {
    user_data.ph = [await sha256(payload.phone)];
  }

  const event: Record<string, unknown> = {
    event_name: payload.eventName,
    event_time: payload.eventTime,
    event_id: payload.eventId,
    action_source: "website",
    user_data,
  };

  if (payload.value !== undefined) {
    event.custom_data = {
      value: payload.value,
      currency: payload.currency ?? process.env.CURRENCY ?? "USD",
      ...(payload.contentIds?.length ? { content_ids: payload.contentIds } : {}),
    };
  }

  const body: Record<string, unknown> = { data: [event] };
  const testCode = process.env.META_TEST_EVENT_CODE;
  if (testCode) body.test_event_code = testCode;

  const url = `https://graph.facebook.com/${version}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await res.json();
    return { ok: res.ok, response };
  } catch (err) {
    console.error("CAPI send error:", err);
    return { ok: false };
  }
}

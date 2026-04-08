import { getAmountBaseCurrency } from "@/lib/amountConversion";
import { normalizePhoneE164 } from "@/lib/phoneNormalize";
import { sha256 } from "./hash";
import {
  capiPayloadSummary,
  insertMetaEventLog,
  updateMetaEventLog,
} from "./metaEventLog";
import { resolveMetaCapiGating } from "./metaTestEvents";

type CAPIEventName = "Lead" | "InitiateCheckout" | "Purchase";

function resolvePixelId(): string | null {
  const serverOnly = process.env.META_PIXEL_ID?.trim();
  const publicId = process.env.NEXT_PUBLIC_META_PIXEL_ID?.trim();
  if (process.env.NODE_ENV === "production") {
    if (!serverOnly) {
      console.error(
        "CAPI: set META_PIXEL_ID in production. NEXT_PUBLIC_META_PIXEL_ID is not used as a fallback for sending events.",
      );
      return null;
    }
    return serverOnly;
  }
  return serverOnly || publicId || null;
}

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
  /** For Purchase — stored on meta_event_logs.order_id */
  orderId?: string | null;
  /** For Lead / InitiateCheckout — stored on meta_event_logs.click_id (often same as eventId) */
  clickId?: string | null;
}

/** Meta Graph Conversions API — snake_case keys per Graph API. */
export async function sendCAPIEvent(payload: CAPIPayload): Promise<{
  ok: boolean;
  response?: unknown;
}> {
  const pixelId = resolvePixelId();
  const token = process.env.META_CONVERSIONS_API_TOKEN;
  const version = process.env.META_API_VERSION ?? "v21.0";

  const gatingOnce = resolveMetaCapiGating();
  const testMode = Boolean(gatingOnce.testEventCode);

  const orderId = payload.orderId ?? null;
  const clickId =
    payload.clickId ??
    (payload.eventName === "Lead" || payload.eventName === "InitiateCheckout"
      ? payload.eventId
      : null);

  const baseLog = {
    order_id: orderId,
    click_id: clickId,
    event_name: payload.eventName,
    event_id: payload.eventId,
    test_mode: testMode,
  };

  async function logSkipped(
    reason: string,
    extra?: Record<string, unknown>
  ): Promise<void> {
    await insertMetaEventLog({
      ...baseLog,
      payload: { ...capiPayloadSummary(payload), skip_reason: reason, ...extra },
      test_mode: testMode,
      status: "skipped",
    });
  }

  if (!pixelId || !token) {
    await logSkipped("missing_credentials", {
      has_pixel_id: Boolean(pixelId),
      has_token: Boolean(token),
    });
    console.warn("CAPI: missing META_PIXEL_ID or META_CONVERSIONS_API_TOKEN");
    return { ok: false };
  }

  if (!gatingOnce.send) {
    await logSkipped("capi_mode_blocked");
    console.info(
      `CAPI [${payload.eventName}] blocked by META_CAPI_MODE gating.`
    );
    return { ok: false };
  }

  const logId = await insertMetaEventLog({
    ...baseLog,
    payload: capiPayloadSummary(payload),
    test_mode: testMode,
    status: "pending",
  });

  const user_data: Record<string, unknown> = {};

  if (payload.ipAddress) user_data.client_ip_address = payload.ipAddress;
  if (payload.userAgent) user_data.client_user_agent = payload.userAgent;
  if (payload.fbclid) {
    user_data.fbc = `fb.1.${payload.eventTime * 1000}.${payload.fbclid}`;
  }
  if (payload.phone) {
    const ph = normalizePhoneE164(payload.phone);
    user_data.ph = [await sha256(ph)];
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
      currency: payload.currency ?? getAmountBaseCurrency(),
      ...(payload.contentIds?.length
        ? { content_ids: payload.contentIds }
        : {}),
    };
  }

  const body: Record<string, unknown> = { data: [event] };
  if (gatingOnce.testEventCode) body.test_event_code = gatingOnce.testEventCode;

  const url = `https://graph.facebook.com/${version}/${pixelId}/events?access_token=${encodeURIComponent(token)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const response = await res.json();
    const ok = res.ok;

    if (logId) {
      await updateMetaEventLog(logId, {
        status: ok ? "sent" : "failed",
        meta_response: response,
        sent_at: new Date().toISOString(),
      });
    }

    return { ok, response };
  } catch (err) {
    if (logId) {
      await updateMetaEventLog(logId, {
        status: "failed",
        meta_response: { error: String(err) },
        sent_at: new Date().toISOString(),
      });
    }
    console.error("CAPI send error:", err);
    return { ok: false };
  }
}

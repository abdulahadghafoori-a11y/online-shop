import { createServiceClient } from "./supabaseServer";

export type MetaEventLogStatus = "pending" | "sent" | "failed" | "skipped";

type InsertRow = {
  order_id?: string | null;
  click_id?: string | null;
  event_name: string;
  event_id: string;
  payload?: Record<string, unknown> | null;
  test_mode: boolean;
  status: MetaEventLogStatus;
  meta_response?: unknown;
  sent_at?: string | null;
};

export function capiPayloadSummary(payload: {
  eventName: string;
  eventId: string;
  eventTime: number;
  value?: number;
  currency?: string;
  fbclid?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  phone?: string | null;
  contentIds?: string[];
}) {
  return {
    event_name: payload.eventName,
    event_id: payload.eventId,
    event_time: payload.eventTime,
    value: payload.value,
    currency: payload.currency,
    has_fbclid: Boolean(payload.fbclid),
    has_ip: Boolean(payload.ipAddress),
    has_ua: Boolean(payload.userAgent),
    has_phone: Boolean(payload.phone),
    content_id_count: payload.contentIds?.length ?? 0,
  };
}

/** Returns new row id, or null if logging is unavailable or fails. */
export async function insertMetaEventLog(row: InsertRow): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("meta_event_logs")
      .insert({
        order_id: row.order_id ?? null,
        click_id: row.click_id ?? null,
        event_name: row.event_name,
        event_id: row.event_id,
        payload: row.payload ?? null,
        test_mode: row.test_mode,
        status: row.status,
        meta_response: row.meta_response ?? null,
        sent_at: row.sent_at ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.warn("meta_event_logs:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (e) {
    console.warn("meta_event_logs:", e);
    return null;
  }
}

export async function updateMetaEventLog(
  id: string,
  patch: {
    status: MetaEventLogStatus;
    meta_response?: unknown;
    sent_at?: string | null;
  }
): Promise<void> {
  try {
    const supabase = createServiceClient();
    const { error } = await supabase
      .from("meta_event_logs")
      .update({
        status: patch.status,
        meta_response: patch.meta_response ?? null,
        sent_at: patch.sent_at ?? new Date().toISOString(),
      })
      .eq("id", id);
    if (error) console.warn("meta_event_logs update:", error.message);
  } catch (e) {
    console.warn("meta_event_logs update:", e);
  }
}

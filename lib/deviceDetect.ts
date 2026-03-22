import type { DeviceType } from "@/types";

export function detectDevice(ua: string): DeviceType {
  const s = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(s)) return "tablet";
  if (
    /mobile|iphone|ipod|android.mobile|blackberry|opera mini|iemobile/.test(s)
  )
    return "mobile";
  if (s.length > 0) return "desktop";
  return "unknown";
}

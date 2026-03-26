/**
 * Meta CAPI safe-gating.
 *
 * META_CAPI_MODE controls what happens:
 *   disabled   → never send anything to Meta (local dev default)
 *   test       → send with test_event_code (required)
 *   production → send real events (only allowed in NODE_ENV=production)
 *
 * If META_CAPI_MODE is unset, we infer:
 *   development → "disabled" (unless META_TEST_EVENT_CODE is set → "test")
 *   production  → "production"
 */

export type MetaCapiMode = "disabled" | "test" | "production";

export function getMetaCapiMode(): MetaCapiMode {
  const explicit = process.env.META_CAPI_MODE?.trim().toLowerCase();
  if (explicit === "disabled" || explicit === "test" || explicit === "production") {
    return explicit;
  }

  if (process.env.NODE_ENV === "production") return "production";

  return getMetaTestEventCodeFromEnv() ? "test" : "disabled";
}

export function getMetaTestEventCodeFromEnv(): string | undefined {
  const v = process.env.META_TEST_EVENT_CODE?.trim();
  return v || undefined;
}

/**
 * Returns `{ send: false }` when the event must be suppressed, or
 * `{ send: true, testEventCode?: string }` when it should fire.
 *
 * Throws if production mode is used outside a production build (fail-safe).
 */
export function resolveMetaCapiGating(): {
  send: boolean;
  testEventCode?: string;
} {
  const mode = getMetaCapiMode();

  if (mode === "disabled") return { send: false };

  if (mode === "production") {
    if (process.env.NODE_ENV !== "production") {
      console.error(
        "META_CAPI_MODE=production is not allowed outside production builds. Blocking send."
      );
      return { send: false };
    }
    return { send: true };
  }

  // mode === "test"
  const testCode = getMetaTestEventCodeFromEnv();
  if (!testCode) {
    console.warn(
      "META_CAPI_MODE=test but META_TEST_EVENT_CODE is empty. Skipping send."
    );
    return { send: false };
  }
  return { send: true, testEventCode: testCode };
}

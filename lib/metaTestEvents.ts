/**
 * Meta Pixel + CAPI: in local dev (`npm run dev`) we only send Events Manager
 * test events. Production builds never attach `test_event_code`.
 */

export function isMetaLocalDevelopment(): boolean {
  return process.env.NODE_ENV === "development";
}

export function getMetaTestEventCodeFromEnv(): string | undefined {
  const v = process.env.META_TEST_EVENT_CODE?.trim();
  return v || undefined;
}

/** Test code to attach when running the dev server; `undefined` in production. */
export function metaTestEventCodeForCurrentEnvironment(): string | undefined {
  if (!isMetaLocalDevelopment()) return undefined;
  return getMetaTestEventCodeFromEnv();
}

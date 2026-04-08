/**
 * Single entry for Meta Conversions API from application code.
 */
export {
  sendCAPIEvent,
  type CAPIPayload,
} from "@/lib/metaConversions";
export {
  getMetaCapiMode,
  resolveMetaCapiGating,
  type MetaCapiMode,
} from "@/lib/metaTestEvents";

/** Islamic Emirate / Afghanistan — 34 provinces for delivery dropdown. Kabul first as default. */
const REST_SORTED = [
  "Badakhshan",
  "Badghis",
  "Baghlan",
  "Balkh",
  "Bamyan",
  "Daykundi",
  "Farah",
  "Faryab",
  "Ghazni",
  "Ghor",
  "Helmand",
  "Herat",
  "Jowzjan",
  "Kandahar",
  "Kapisa",
  "Khost",
  "Kunar",
  "Kunduz",
  "Laghman",
  "Logar",
  "Nangarhar",
  "Nimruz",
  "Nuristan",
  "Paktia",
  "Paktika",
  "Panjshir",
  "Parwan",
  "Samangan",
  "Sar-e Pol",
  "Takhar",
  "Urozgan",
  "Wardak",
  "Zabul",
] as const;

export const AFGHANISTAN_PROVINCES: string[] = [
  "Kabul",
  ...REST_SORTED,
];

export const DEFAULT_AFGHAN_PROVINCE = "Kabul";

/**
 * Default delivery cost by province (in book/base currency).
 * Kabul = hand-delivered (0). Everything else defaults to a standard
 * inter-province courier rate. Override per-province as needed.
 */
const INTER_PROVINCE_DEFAULT = 250;

const ZONE_OVERRIDES: Record<string, number> = {
  Kabul: 0,
  Parwan: 150,
  Kapisa: 150,
  Logar: 150,
  Wardak: 150,
  Panjshir: 200,
};

export function getDefaultDeliveryCost(province: string): number {
  return ZONE_OVERRIDES[province] ?? INTER_PROVINCE_DEFAULT;
}

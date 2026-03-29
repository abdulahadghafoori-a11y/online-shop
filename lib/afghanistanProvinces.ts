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

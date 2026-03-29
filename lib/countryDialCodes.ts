/** Dial codes for phone input (E.164 prefix). Each row has a unique `id` for selects (e.g. US and Canada both +1). */
export const COUNTRY_DIAL_OPTIONS: { id: string; label: string; dial: string }[] = [
  { id: "af", label: "Afghanistan (+93)", dial: "+93" },
  { id: "al", label: "Albania (+355)", dial: "+355" },
  { id: "dz", label: "Algeria (+213)", dial: "+213" },
  { id: "ar", label: "Argentina (+54)", dial: "+54" },
  { id: "au", label: "Australia (+61)", dial: "+61" },
  { id: "at", label: "Austria (+43)", dial: "+43" },
  { id: "bd", label: "Bangladesh (+880)", dial: "+880" },
  { id: "be", label: "Belgium (+32)", dial: "+32" },
  { id: "br", label: "Brazil (+55)", dial: "+55" },
  { id: "ca", label: "Canada (+1)", dial: "+1" },
  { id: "cn", label: "China (+86)", dial: "+86" },
  { id: "dk", label: "Denmark (+45)", dial: "+45" },
  { id: "eg", label: "Egypt (+20)", dial: "+20" },
  { id: "fr", label: "France (+33)", dial: "+33" },
  { id: "de", label: "Germany (+49)", dial: "+49" },
  { id: "in", label: "India (+91)", dial: "+91" },
  { id: "id", label: "Indonesia (+62)", dial: "+62" },
  { id: "ir", label: "Iran (+98)", dial: "+98" },
  { id: "iq", label: "Iraq (+964)", dial: "+964" },
  { id: "it", label: "Italy (+39)", dial: "+39" },
  { id: "jp", label: "Japan (+81)", dial: "+81" },
  { id: "ke", label: "Kenya (+254)", dial: "+254" },
  { id: "mx", label: "Mexico (+52)", dial: "+52" },
  { id: "ma", label: "Morocco (+212)", dial: "+212" },
  { id: "nl", label: "Netherlands (+31)", dial: "+31" },
  { id: "ng", label: "Nigeria (+234)", dial: "+234" },
  { id: "no", label: "Norway (+47)", dial: "+47" },
  { id: "pk", label: "Pakistan (+92)", dial: "+92" },
  { id: "pl", label: "Poland (+48)", dial: "+48" },
  { id: "ru", label: "Russia (+7)", dial: "+7" },
  { id: "sa", label: "Saudi Arabia (+966)", dial: "+966" },
  { id: "za", label: "South Africa (+27)", dial: "+27" },
  { id: "kr", label: "South Korea (+82)", dial: "+82" },
  { id: "es", label: "Spain (+34)", dial: "+34" },
  { id: "se", label: "Sweden (+46)", dial: "+46" },
  { id: "ch", label: "Switzerland (+41)", dial: "+41" },
  { id: "tr", label: "Türkiye (+90)", dial: "+90" },
  { id: "ae", label: "United Arab Emirates (+971)", dial: "+971" },
  { id: "gb", label: "United Kingdom (+44)", dial: "+44" },
  { id: "us", label: "United States (+1)", dial: "+1" },
  { id: "uz", label: "Uzbekistan (+998)", dial: "+998" },
  { id: "vn", label: "Vietnam (+84)", dial: "+84" },
];

export const DEFAULT_COUNTRY_ID = COUNTRY_DIAL_OPTIONS[0].id;

/** Join dial prefix and local digits into E.164-style phone. */
export function combineInternationalPhone(
  dial: string,
  localDigits: string,
): string {
  const prefix = dial.trim().startsWith("+") ? dial.trim() : `+${dial.trim()}`;
  const local = localDigits.replace(/\D/g, "");
  return local ? `${prefix}${local}` : "";
}

/**
 * Human-readable spacing for review UIs: country code, then grouped local digits
 * (3-3-4 when length ≡ 1 (mod 3), e.g. many 10-digit numbers; otherwise groups of 3 from the right).
 */
export function formatInternationalPhoneForDisplay(
  dial: string,
  localDigits: string,
): string {
  const prefix = dial.trim().startsWith("+") ? dial.trim() : `+${dial.trim()}`;
  const local = localDigits.replace(/\D/g, "");
  if (!local) return prefix;

  const parts: string[] = [];
  let rest = local;
  if (rest.length >= 7 && rest.length % 3 === 1) {
    parts.unshift(rest.slice(-4));
    rest = rest.slice(0, -4);
  }
  while (rest.length > 0) {
    if (rest.length <= 3) {
      parts.unshift(rest);
      break;
    }
    parts.unshift(rest.slice(-3));
    rest = rest.slice(0, -3);
  }

  return `${prefix} ${parts.join(" ")}`;
}

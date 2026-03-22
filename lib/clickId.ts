import { customAlphabet } from "nanoid";

const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const rand4 = customAlphabet(alphabet, 4);

/** CK-{base36-timestamp}-{4 random chars}, e.g. CK-LY2K4F-X7QR */
export function generateClickId(): string {
  const ts = Date.now().toString(36).toUpperCase();
  return `CK-${ts}-${rand4()}`;
}

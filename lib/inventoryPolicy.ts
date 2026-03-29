/** When false (default), orders cannot push stock_on_hand below zero. */
export function allowNegativeStock(): boolean {
  return process.env.ALLOW_NEGATIVE_STOCK?.trim().toLowerCase() === "true";
}

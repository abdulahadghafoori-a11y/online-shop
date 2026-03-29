import type { PurchaseReportLineRow } from "@/types";

export type ProductNested =
  | { name: string; sku: string }
  | { name: string; sku: string }[]
  | null;

export type RawPurchaseOrderItem = {
  quantity: number | string;
  unit_cost: number | string;
  base_cost?: number | string | null;
  shipping_cost_per_unit?: number | string | null;
  packaging_cost_per_unit?: number | string | null;
  product_id?: string;
  products?: ProductNested;
};

function productMeta(p: ProductNested | undefined): { name: string; sku: string } {
  if (!p) return { name: "—", sku: "—" };
  const row = Array.isArray(p) ? p[0] : p;
  if (!row) return { name: "—", sku: "—" };
  return {
    name: row.name ?? "—",
    sku: row.sku ?? "—",
  };
}

export function mapPurchaseOrderItemToLine(
  i: RawPurchaseOrderItem,
): PurchaseReportLineRow {
  const { name, sku } = productMeta(i.products);
  const q = Number(i.quantity);
  const base = Number(i.base_cost ?? 0);
  const ship = Number(i.shipping_cost_per_unit ?? 0);
  const pack = Number(i.packaging_cost_per_unit ?? 0);
  const unitCost = Number(i.unit_cost);
  const landed = base + ship + pack;
  return {
    product_id: String(i.product_id ?? ""),
    product_name: name,
    sku,
    quantity: q,
    base_cost: base,
    shipping_cost_per_unit: ship,
    packaging_cost_per_unit: pack,
    landed_unit: landed,
    unit_cost: unitCost,
    extended_base: q * base,
    extended_shipping: q * ship,
    extended_packaging: q * pack,
    extended_total: q * unitCost,
  };
}

export function summarizePurchaseLines(lines: PurchaseReportLineRow[]): {
  total_qty: number;
  total_value: number;
  total_extended_base: number;
  total_extended_shipping: number;
  total_extended_packaging: number;
} {
  let total_qty = 0;
  let total_value = 0;
  let total_extended_base = 0;
  let total_extended_shipping = 0;
  let total_extended_packaging = 0;
  for (const line of lines) {
    total_qty += line.quantity;
    total_value += line.extended_total;
    total_extended_base += line.extended_base;
    total_extended_shipping += line.extended_shipping;
    total_extended_packaging += line.extended_packaging;
  }
  return {
    total_qty,
    total_value,
    total_extended_base,
    total_extended_shipping,
    total_extended_packaging,
  };
}

export type DeviceType = "mobile" | "tablet" | "desktop" | "unknown";
export type OrderStatus =
  | "pending"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "cancelled";
export type CampaignStatus = "active" | "paused" | "stopped";
export type UserRole = "admin" | "manager" | "salesagent";
export type ConversionStatus = "pending" | "sent" | "failed";
export type InventoryTxType = "purchase" | "sale" | "adjustment";
export type ScalingLabel = "SCALE" | "WATCH" | "KILL";
export type AttributionMethod =
  | "clickid"
  | "adid"
  | "phone"
  | "timewindow"
  | "productmatch"
  | "unknown";

export interface Product {
  id: string;
  name: string;
  sku: string;
  defaultsaleprice: number;
  isactive: boolean;
  createdat: string;
}

export interface ProductCost {
  id: string;
  productid: string;
  unitcost: number;
  createdat: string;
}

export interface Campaign {
  id: string;
  name: string;
  platform: "facebook" | "instagram" | "other";
  status: CampaignStatus;
  createdat: string;
}

export interface Adset {
  id: string;
  campaignid: string;
  name: string;
  createdat: string;
}

export interface Ad {
  id: string;
  adsetid: string;
  name: string;
  createdat: string;
}

export interface Click {
  id: string;
  clickid: string;
  fbclid: string | null;
  campaignid: string | null;
  adsetid: string | null;
  adid: string | null;
  utmsource: string | null;
  utmcampaign: string | null;
  utmcontent: string | null;
  ipaddress: string | null;
  useragent: string | null;
  devicetype: DeviceType;
  createdat: string;
}

export interface Lead {
  id: string;
  clickid: string | null;
  adid: string | null;
  phone: string | null;
  createdat: string;
}

export interface Order {
  id: string;
  leadid: string | null;
  clickid: string | null;
  adid: string | null;
  adsetid: string | null;
  campaignid: string | null;
  phone: string;
  deliverycost: number;
  allocatedadspend: number;
  meta_sent: boolean;
  status: OrderStatus;
  attributionmethod: AttributionMethod | null;
  confidencescore: number;
  createdby: string | null;
  createdat: string;
}

export interface OrderItem {
  id: string;
  orderid: string;
  productid: string;
  quantity: number;
  saleprice: number;
  unitcost: number;
  /** COGS unit cost frozen at sale time (moving WAC snapshot). */
  product_cost_snapshot: number;
}

export interface InventoryTransaction {
  id: string;
  productid: string;
  type: InventoryTxType;
  quantity: number;
  unitcost: number | null;
  referenceid: string | null;
  createdat: string;
}

export interface DailyAdStat {
  id: string;
  campaignid: string;
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
}

export interface OrderItemInput {
  productid: string;
  quantity: number;
  saleprice: number;
}

export interface CreateOrderPayload {
  phone: string;
  items: OrderItemInput[];
  deliverycost: number;
  clickid?: string;
  adid?: string;
  deliveryaddress?: string;
  trackingnumber?: string;
  status?: OrderStatus;
}

export interface AttributionResult {
  clickid: string | null;
  adid: string | null;
  /** Populated when click or ad path resolves (persisted on orders). */
  adsetid: string | null;
  campaignid: string | null;
  method: AttributionMethod;
  confidence: number;
}

export interface CampaignReport {
  campaignid: string;
  campaignname: string;
  spend: number;
  revenue: number;
  profit: number;
  orders: number;
  roas: number;
  cpa: number;
}

export interface ProductReport {
  productid: string;
  productname: string;
  unitssold: number;
  revenue: number;
  cost: number;
  profit: number;
}

export interface OrderProfitReportRow {
  order_id: string;
  phone: string | null;
  status: string;
  created_at: string;
  revenue: number;
  cogs: number;
  delivery_cost: number;
  allocated_ad_spend: number;
  profit: number;
  line_items: number;
}

export interface InventoryReportSnapshotRow {
  id: string;
  name: string;
  sku: string;
  stock_on_hand: number;
  avg_cost: number;
  value: number;
}

export interface InventoryReportResponse {
  snapshot: InventoryReportSnapshotRow[];
  movementTotals: { IN: number; OUT: number; ADJUSTMENT: number };
}

/** One PO line in purchase reports — book currency per unit + extensions. */
export interface PurchaseReportLineRow {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  base_cost: number;
  shipping_cost_per_unit: number;
  packaging_cost_per_unit: number;
  /** base + shipping + packaging per unit */
  landed_unit: number;
  /** Stored rolled unit cost (often matches landed). */
  unit_cost: number;
  extended_base: number;
  extended_shipping: number;
  extended_packaging: number;
  extended_total: number;
}

export interface PurchaseReportRow {
  id: string;
  supplier_name: string;
  status: string;
  created_at: string;
  received_at: string | null;
  line_count: number;
  total_qty: number;
  total_value: number;
  total_extended_base: number;
  total_extended_shipping: number;
  total_extended_packaging: number;
  lines: PurchaseReportLineRow[];
}

export interface FunnelReport {
  clicks: number;
  leads: number;
  orders: number;
  clicktolead: string;
  leadtoorder: string;
  clicktoorder: string;
}

export interface ScalingRow extends CampaignReport {
  profitperorder: number;
  label: ScalingLabel;
}

export type PurchaseOrderStatus = "draft" | "received" | "cancelled";

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  status: PurchaseOrderStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  received_at: string | null;
  fx_afn_per_usd: number | null;
  fx_cny_per_usd: number | null;
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  base_cost?: number;
  shipping_cost_per_unit?: number;
  packaging_cost_per_unit?: number;
  created_at: string;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  quantity: number;
  reason: string;
  created_by: string | null;
  created_at: string;
}

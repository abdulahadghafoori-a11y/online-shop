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
  campaignid: string | null;
  phone: string;
  deliverycost: number;
  allocatedadspend: number;
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

export interface TrackClickPayload {
  campaignid?: string;
  adsetid?: string;
  adid?: string;
  fbclid?: string;
  utmsource?: string;
  utmcampaign?: string;
  utmcontent?: string;
  productname?: string;
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
  status?: OrderStatus;
}

export interface AttributionResult {
  clickid: string | null;
  adid: string | null;
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

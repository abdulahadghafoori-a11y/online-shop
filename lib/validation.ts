import { z } from "zod";

// ─── Create Order ───────────────────────────────────────────────

export const OrderItemSchema = z.object({
  productid: z.string().uuid("Invalid product ID"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  saleprice: z.number().nonnegative("Sale price cannot be negative"),
});

export const CreateOrderSchema = z.object({
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(/^\+?\d[\d\s\-()]{4,}$/, "Invalid phone number"),
  items: z.array(OrderItemSchema).min(1, "At least one line item required"),
  deliverycost: z.number().nonnegative().default(0),
  clickid: z.string().trim().optional(),
  adid: z.string().trim().optional(),
  /** Shipping / delivery address (e.g. city). */
  deliveryaddress: z.string().trim().min(1, "Address is required"),
  /** Optional carrier tracking (e.g. inter‑province shipments). */
  trackingnumber: z.string().trim().optional(),
  status: z
    .enum(["pending", "confirmed", "shipped", "delivered", "cancelled"])
    .default("pending"),
});

export type ValidatedCreateOrder = z.infer<typeof CreateOrderSchema>;

// ─── Product ────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  defaultsaleprice: z
    .number({ error: "Enter a valid default sale price." })
    .finite("Enter a valid default sale price.")
    .nonnegative("Price cannot be negative"),
  isactive: z.boolean().default(true),
  initialunitcost: z
    .number()
    .finite()
    .nonnegative()
    .optional(),
});

export const UpdateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required"),
  defaultsaleprice: z
    .number({ error: "Enter a valid default sale price." })
    .finite("Enter a valid default sale price.")
    .nonnegative("Price cannot be negative"),
  isactive: z.boolean().default(true),
});

// ─── Purchases ──────────────────────────────────────────────────

export const PurchaseItemSchema = z
  .object({
    productid: z.string().uuid("Invalid product ID"),
    quantity: z.number().positive("Quantity must be positive"),
    base_cost: z.number().nonnegative(),
    shipping_cost_per_unit: z.number().nonnegative(),
    packaging_cost_per_unit: z.number().nonnegative(),
  })
  .refine(
    (d) =>
      d.base_cost + d.shipping_cost_per_unit + d.packaging_cost_per_unit > 0,
    {
      message:
        "Each line needs a positive total (base + shipping + packaging per unit)",
    }
  );

export const CreatePurchaseSchema = z.object({
  suppliername: z.string().trim().min(1, "Supplier name is required"),
  items: z
    .array(PurchaseItemSchema)
    .min(1, "At least one item is required"),
});

// ─── Stock Adjustment ───────────────────────────────────────────

export const StockAdjustmentSchema = z.object({
  productid: z.string().uuid("Invalid product ID"),
  quantity: z.number().int().refine((n) => n !== 0, "Quantity cannot be zero"),
  reason: z.string().trim().min(1, "Reason is required"),
});

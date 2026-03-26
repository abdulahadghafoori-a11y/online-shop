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
  status: z
    .enum(["pending", "confirmed", "shipped", "delivered", "cancelled"])
    .default("pending"),
});

export type ValidatedCreateOrder = z.infer<typeof CreateOrderSchema>;

// ─── Product ────────────────────────────────────────────────────

export const CreateProductSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  defaultsaleprice: z.number().nonnegative("Price cannot be negative"),
  isactive: z.boolean().default(true),
  initialunitcost: z.number().nonnegative().optional(),
});

export const UpdateProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1, "Name is required"),
  defaultsaleprice: z.number().nonnegative("Price cannot be negative"),
  isactive: z.boolean().default(true),
});

export const AddProductCostSchema = z.object({
  productid: z.string().uuid(),
  unitcost: z.number().nonnegative("Unit cost cannot be negative"),
});

// ─── Purchases ──────────────────────────────────────────────────

export const PurchaseItemSchema = z.object({
  productid: z.string().uuid("Invalid product ID"),
  quantity: z.number().int().positive("Quantity must be at least 1"),
  unitcost: z.number().nonnegative("Unit cost cannot be negative"),
});

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

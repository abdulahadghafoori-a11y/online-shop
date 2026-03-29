-- Planning base/ship/pack live on PO lines & receipts only; not on products.

ALTER TABLE public.products DROP COLUMN IF EXISTS base_cost;
ALTER TABLE public.products DROP COLUMN IF EXISTS shipping_cost_per_unit;
ALTER TABLE public.products DROP COLUMN IF EXISTS packaging_cost_per_unit;

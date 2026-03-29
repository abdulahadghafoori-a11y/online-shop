-- Customer delivery address and optional courier tracking (e.g. inter‑province).

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS deliveryaddress text NOT NULL DEFAULT 'Kabul';

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS trackingnumber text;

COMMENT ON COLUMN public.orders.deliveryaddress IS 'Shipping / delivery address (e.g. city).';
COMMENT ON COLUMN public.orders.trackingnumber IS 'Optional carrier tracking when shipping outside local area.';

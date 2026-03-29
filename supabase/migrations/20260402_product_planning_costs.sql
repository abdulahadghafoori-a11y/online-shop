-- Planning / reference unit costs (not COGS — WAC avg_cost still drives inventory & order snapshots)

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS base_cost numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost_per_unit numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost_per_unit numeric(12,6) NOT NULL DEFAULT 0;

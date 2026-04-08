-- Add description, image_url, and reorder_point to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE products ADD COLUMN IF NOT EXISTS reorder_point integer NOT NULL DEFAULT 0;

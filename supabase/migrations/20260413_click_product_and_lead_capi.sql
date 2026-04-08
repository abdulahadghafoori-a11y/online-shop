-- Add product interest column to clicks
ALTER TABLE clicks ADD COLUMN IF NOT EXISTS product text;

-- Custom WhatsApp message template per product
-- Supports {product} and {code} placeholders
ALTER TABLE products ADD COLUMN IF NOT EXISTS wa_message text;

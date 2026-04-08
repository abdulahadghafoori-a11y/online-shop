-- Recommended fixes: meta_sent flag, FX snapshot on POs, batch ad-spend reallocation
-- ══════════════════════════════════════════════════════════════════════════════

-- 1) Add meta_sent boolean to orders for quick CAPI status queries
ALTER TABLE orders ADD COLUMN IF NOT EXISTS meta_sent boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_orders_meta_sent ON orders (meta_sent) WHERE meta_sent = false;

-- 2) Add FX snapshot columns to purchase_orders (audit trail for cost conversions)
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS fx_afn_per_usd numeric(14,6);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS fx_cny_per_usd numeric(14,6);

-- 3) Batch ad-spend re-allocation: evenly distribute a campaign's daily spend
--    across ALL orders for that campaign+day.  Called when a new order is created
--    so every sibling order on the same day gets a fair share.
CREATE OR REPLACE FUNCTION public.reallocate_campaign_day_ad_spend(
  p_campaign_id uuid,
  p_date date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_spend numeric;
  v_day_orders bigint;
  v_allocated numeric;
BEGIN
  IF p_campaign_id IS NULL THEN
    RETURN;
  END IF;

  SELECT coalesce(sum(dai.spend), 0)
  INTO v_day_spend
  FROM daily_ad_insights dai
  WHERE dai.campaign_id = p_campaign_id
    AND dai.date = p_date;

  SELECT count(*)
  INTO v_day_orders
  FROM orders o
  WHERE o.campaignid = p_campaign_id
    AND o.createdat::date = p_date
    AND o.status != 'cancelled';

  IF v_day_orders <= 0 THEN
    v_allocated := 0;
  ELSE
    v_allocated := round(v_day_spend / v_day_orders, 2);
  END IF;

  UPDATE orders
  SET allocatedadspend = v_allocated
  WHERE campaignid = p_campaign_id
    AND createdat::date = p_date
    AND status != 'cancelled';
END;
$$;

GRANT EXECUTE ON FUNCTION public.reallocate_campaign_day_ad_spend(uuid, date)
  TO authenticated, service_role;

-- 4) Backfill meta_sent from existing conversionevents
UPDATE orders o
SET meta_sent = true
WHERE EXISTS (
  SELECT 1 FROM conversionevents ce
  WHERE ce.orderid = o.id
    AND ce.eventtype = 'Purchase'
    AND ce.status = 'sent'
)
AND o.meta_sent = false;

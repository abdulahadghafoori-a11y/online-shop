-- Row level security for tables added after base schema (see 20260327 migration).
-- Service role bypasses RLS; dashboard uses authenticated via Supabase SSR.

ALTER TABLE meta_event_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth access" ON meta_event_logs;
CREATE POLICY "Auth access" ON meta_event_logs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Auth access" ON purchase_orders;
CREATE POLICY "Auth access" ON purchase_orders
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Auth access" ON purchase_order_items;
CREATE POLICY "Auth access" ON purchase_order_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Auth access" ON stock_adjustments;
CREATE POLICY "Auth access" ON stock_adjustments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON meta_event_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON purchase_order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON stock_adjustments TO authenticated;

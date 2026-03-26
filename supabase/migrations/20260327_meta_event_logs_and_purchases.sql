-- ============================================================
-- 1. Meta Event Logs — auditable log of every CAPI send attempt
-- ============================================================

CREATE TABLE IF NOT EXISTS meta_event_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id    uuid REFERENCES orders(id) ON DELETE SET NULL,
  click_id    text,
  event_name  text NOT NULL,
  event_id    text NOT NULL,
  payload     jsonb,
  test_mode   boolean NOT NULL DEFAULT false,
  status      text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  meta_response jsonb,
  sent_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_meta_event_logs_order  ON meta_event_logs(order_id);
CREATE INDEX idx_meta_event_logs_event  ON meta_event_logs(event_id);
CREATE UNIQUE INDEX uq_meta_event_logs_dedup
  ON meta_event_logs(event_name, event_id)
  WHERE status = 'sent';

-- ============================================================
-- 2. Purchase Orders
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_name text NOT NULL,
  status        text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','received','cancelled')),
  notes         text,
  created_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  received_at   timestamptz
);

-- ============================================================
-- 3. Purchase Order Items
-- ============================================================

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id        uuid NOT NULL REFERENCES products(id),
  quantity          numeric(12,2) NOT NULL CHECK (quantity > 0),
  unit_cost         numeric(12,6) NOT NULL CHECK (unit_cost >= 0),
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_poi_purchase ON purchase_order_items(purchase_order_id);
CREATE INDEX idx_poi_product  ON purchase_order_items(product_id);

-- ============================================================
-- 4. Stock Adjustments
-- ============================================================

CREATE TABLE IF NOT EXISTS stock_adjustments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES products(id),
  quantity    integer NOT NULL CHECK (quantity <> 0),
  reason      text NOT NULL,
  created_by  uuid REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_stock_adj_product ON stock_adjustments(product_id);

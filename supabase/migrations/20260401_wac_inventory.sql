-- Weighted average cost (WAC), stock_receipts, inventory_movements, order cost snapshot

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS avg_cost numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_on_hand integer NOT NULL DEFAULT 0;

-- Backfill stock from legacy inventorytransactions (if present)
UPDATE products p
SET stock_on_hand = COALESCE(s.q, 0)::integer
FROM (
  SELECT productid, SUM(quantity)::bigint AS q
  FROM inventorytransactions
  GROUP BY productid
) s
WHERE p.id = s.productid;

-- Backfill avg_cost from latest productcosts row per product
UPDATE products p
SET avg_cost = COALESCE(c.unitcost, 0)
FROM (
  SELECT DISTINCT ON (productid) productid, unitcost
  FROM productcosts
  ORDER BY productid, createdat DESC
) c
WHERE p.id = c.productid;

CREATE TABLE IF NOT EXISTS stock_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  qty_received integer NOT NULL CHECK (qty_received > 0),
  unit_cost numeric(14,6) NOT NULL CHECK (unit_cost >= 0),
  total_cost numeric(18,6) GENERATED ALWAYS AS ((qty_received::numeric * unit_cost)) STORED,
  received_date date NOT NULL DEFAULT (CURRENT_DATE),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_receipts_product ON stock_receipts(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_receipts_received_date ON stock_receipts(received_date DESC);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  movement_type text NOT NULL CHECK (movement_type IN ('IN', 'OUT', 'ADJUSTMENT')),
  qty integer NOT NULL CHECK (qty <> 0),
  unit_cost_snapshot numeric(14,6),
  reference_type text,
  reference_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC);

ALTER TABLE orderitems
  ADD COLUMN IF NOT EXISTS product_cost_snapshot numeric(12,6) NOT NULL DEFAULT 0;

UPDATE orderitems
SET product_cost_snapshot = unitcost
WHERE product_cost_snapshot = 0 AND unitcost IS NOT NULL;

CREATE OR REPLACE VIEW inventorybalance AS
SELECT
  p.id AS productid,
  p.name AS productname,
  p.sku,
  p.stock_on_hand::bigint AS stockonhand
FROM products p;

-- ============================================================================
-- apply_stock_receipt: WAC update + receipt row + IN movement (single txn)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_stock_receipt(
  p_product_id uuid,
  p_qty integer,
  p_unit_cost numeric,
  p_notes text DEFAULT NULL,
  p_received_date date DEFAULT CURRENT_DATE
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer;
  v_avg numeric(14,6);
  v_existing_val numeric(24,8);
  v_new_val numeric(24,8);
  v_new_stock integer;
  v_new_avg numeric(14,6);
  v_receipt_id uuid;
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'qty must be positive';
  END IF;
  IF p_unit_cost < 0 THEN
    RAISE EXCEPTION 'unit_cost cannot be negative';
  END IF;

  SELECT stock_on_hand, avg_cost
    INTO v_stock, v_avg
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  v_existing_val := v_stock::numeric * v_avg;
  v_new_val := p_qty::numeric * p_unit_cost;
  v_new_stock := v_stock + p_qty;

  IF v_new_stock > 0 THEN
    v_new_avg := (v_existing_val + v_new_val) / v_new_stock::numeric;
  ELSE
    v_new_avg := v_avg;
  END IF;

  UPDATE products
  SET stock_on_hand = v_new_stock,
      avg_cost = round(v_new_avg::numeric, 6)
  WHERE id = p_product_id;

  INSERT INTO stock_receipts (product_id, qty_received, unit_cost, received_date, notes)
  VALUES (p_product_id, p_qty, p_unit_cost, p_received_date, p_notes)
  RETURNING id INTO v_receipt_id;

  INSERT INTO inventory_movements (
    product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id
  ) VALUES (
    p_product_id, 'IN', p_qty, p_unit_cost, 'receipt', v_receipt_id
  );

  RETURN jsonb_build_object(
    'receipt_id', v_receipt_id,
    'new_avg_cost', round(v_new_avg::numeric, 6),
    'new_stock', v_new_stock
  );
END;
$$;

-- ============================================================================
-- apply_order_sales_and_items: snapshots, OUT movements, decrement stock
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_order_sales_and_items(
  p_order_id uuid,
  p_items jsonb,
  p_allow_negative boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
  v_stock integer;
  v_avg numeric(14,6);
  v_snap numeric(14,6);
BEGIN
  FOR r IN
    SELECT *
    FROM jsonb_to_recordset(p_items) AS t(
      productid uuid,
      quantity integer,
      saleprice numeric
    )
  LOOP
    IF r.quantity IS NULL OR r.quantity <= 0 THEN
      RAISE EXCEPTION 'invalid quantity';
    END IF;

    SELECT stock_on_hand, avg_cost
      INTO v_stock, v_avg
    FROM products
    WHERE id = r.productid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'product not found: %', r.productid;
    END IF;

    v_snap := round(COALESCE(v_avg, 0)::numeric, 6);

    IF NOT p_allow_negative AND v_stock < r.quantity THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', r.productid;
    END IF;

    INSERT INTO orderitems (
      orderid, productid, quantity, saleprice, unitcost, product_cost_snapshot
    ) VALUES (
      p_order_id, r.productid, r.quantity, r.saleprice, v_snap, v_snap
    );

    UPDATE products
    SET stock_on_hand = stock_on_hand - r.quantity
    WHERE id = r.productid;

    INSERT INTO inventory_movements (
      product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id
    ) VALUES (
      r.productid, 'OUT', r.quantity, v_snap, 'order', p_order_id
    );
  END LOOP;
END;
$$;

-- ============================================================================
-- apply_inventory_adjustment: qty delta (signed), no WAC change
-- ============================================================================
CREATE OR REPLACE FUNCTION public.apply_inventory_adjustment(
  p_product_id uuid,
  p_qty_delta integer,
  p_reference_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_stock integer;
BEGIN
  IF p_qty_delta = 0 THEN
    RAISE EXCEPTION 'adjustment qty cannot be zero';
  END IF;

  SELECT stock_on_hand INTO v_stock
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  UPDATE products
  SET stock_on_hand = stock_on_hand + p_qty_delta
  WHERE id = p_product_id;

  INSERT INTO inventory_movements (
    product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id
  ) VALUES (
    p_product_id, 'ADJUSTMENT', p_qty_delta, NULL, 'adjustment', p_reference_id
  );

  RETURN jsonb_build_object(
    'new_stock',
    (SELECT stock_on_hand FROM products WHERE id = p_product_id)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_stock_receipt(uuid, integer, numeric, text, date) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_order_sales_and_items(uuid, jsonb, boolean) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_inventory_adjustment(uuid, integer, uuid) TO service_role, authenticated;

ALTER TABLE stock_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth access" ON stock_receipts;
CREATE POLICY "Auth access" ON stock_receipts FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Auth access" ON inventory_movements;
CREATE POLICY "Auth access" ON inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON stock_receipts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON inventory_movements TO authenticated;

-- Profit helpers: COGS from snapshot at sale time
CREATE OR REPLACE FUNCTION public.orderprofit(p_orderid uuid)
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT
    coalesce(sum(oi.saleprice * oi.quantity), 0)
    - coalesce(sum(oi.product_cost_snapshot * oi.quantity), 0)
    - coalesce(max(o.deliverycost), 0)
    - coalesce(max(o.allocatedadspend), 0)
  FROM orders o
  JOIN orderitems oi ON oi.orderid = o.id
  WHERE o.id = p_orderid;
$$;

CREATE OR REPLACE FUNCTION public.productprofitreport(datefrom text, dateto text)
RETURNS TABLE (
  productid uuid,
  productname text,
  unitssold bigint,
  revenue numeric,
  cost numeric,
  profit numeric
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    p.id AS productid,
    p.name AS productname,
    coalesce(sum(oi.quantity), 0)::bigint AS unitssold,
    coalesce(sum(oi.saleprice * oi.quantity), 0) AS revenue,
    coalesce(sum(oi.product_cost_snapshot * oi.quantity), 0) AS cost,
    coalesce(sum((oi.saleprice - oi.product_cost_snapshot) * oi.quantity), 0) AS profit
  FROM products p
  LEFT JOIN orderitems oi ON oi.productid = p.id
  LEFT JOIN orders o ON o.id = oi.orderid
    AND o.createdat >= datefrom::timestamptz
    AND o.createdat < (dateto::date + interval '1 day')::timestamptz
    AND o.status != 'cancelled'
  GROUP BY p.id, p.name
  ORDER BY profit DESC NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.getunitcost(p_productid uuid, p_at timestamptz DEFAULT now())
RETURNS numeric
LANGUAGE sql
STABLE
AS $$
  SELECT avg_cost FROM products WHERE id = p_productid;
$$;

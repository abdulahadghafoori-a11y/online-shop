-- Actual landed unit cost components on purchase lines and stock receipts.
-- WAC still uses rolled-up unit_cost = base + shipping + packaging (per unit).

ALTER TABLE purchase_order_items
  ADD COLUMN IF NOT EXISTS base_cost numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost_per_unit numeric(12,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost_per_unit numeric(12,6) NOT NULL DEFAULT 0;

UPDATE purchase_order_items
SET
  base_cost = unit_cost,
  shipping_cost_per_unit = 0,
  packaging_cost_per_unit = 0
WHERE base_cost = 0 AND packaging_cost_per_unit = 0 AND shipping_cost_per_unit = 0 AND unit_cost > 0;

ALTER TABLE stock_receipts
  ADD COLUMN IF NOT EXISTS base_cost numeric(14,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS shipping_cost_per_unit numeric(14,6) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS packaging_cost_per_unit numeric(14,6) NOT NULL DEFAULT 0;

UPDATE stock_receipts
SET
  base_cost = unit_cost,
  shipping_cost_per_unit = 0,
  packaging_cost_per_unit = 0
WHERE base_cost = 0 AND shipping_cost_per_unit = 0 AND packaging_cost_per_unit = 0;

DROP FUNCTION IF EXISTS public.apply_stock_receipt(uuid, integer, numeric, text, date);

CREATE OR REPLACE FUNCTION public.apply_stock_receipt(
  p_product_id uuid,
  p_qty integer,
  p_base_cost numeric,
  p_shipping_cost_per_unit numeric,
  p_packaging_cost_per_unit numeric,
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
  v_base numeric(14,6);
  v_ship numeric(14,6);
  v_pack numeric(14,6);
  v_unit numeric(14,6);
BEGIN
  IF p_qty <= 0 THEN
    RAISE EXCEPTION 'qty must be positive';
  END IF;

  v_base := round(coalesce(p_base_cost, 0)::numeric, 6);
  v_ship := round(coalesce(p_shipping_cost_per_unit, 0)::numeric, 6);
  v_pack := round(coalesce(p_packaging_cost_per_unit, 0)::numeric, 6);

  IF v_base < 0 OR v_ship < 0 OR v_pack < 0 THEN
    RAISE EXCEPTION 'cost components cannot be negative';
  END IF;

  v_unit := round(v_base + v_ship + v_pack, 6);

  SELECT stock_on_hand, avg_cost
    INTO v_stock, v_avg
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'product not found';
  END IF;

  v_existing_val := v_stock::numeric * v_avg;
  v_new_val := p_qty::numeric * v_unit;
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

  INSERT INTO stock_receipts (
    product_id,
    qty_received,
    unit_cost,
    base_cost,
    shipping_cost_per_unit,
    packaging_cost_per_unit,
    received_date,
    notes
  ) VALUES (
    p_product_id,
    p_qty,
    v_unit,
    v_base,
    v_ship,
    v_pack,
    p_received_date,
    p_notes
  )
  RETURNING id INTO v_receipt_id;

  INSERT INTO inventory_movements (
    product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id
  ) VALUES (
    p_product_id, 'IN', p_qty, v_unit, 'receipt', v_receipt_id
  );

  RETURN jsonb_build_object(
    'receipt_id', v_receipt_id,
    'new_avg_cost', round(v_new_avg::numeric, 6),
    'new_stock', v_new_stock
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_stock_receipt(
  uuid,
  integer,
  numeric,
  numeric,
  numeric,
  text,
  date
) TO service_role, authenticated;

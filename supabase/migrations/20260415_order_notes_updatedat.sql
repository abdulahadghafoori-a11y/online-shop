-- Add notes and updatedat to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS updatedat timestamptz;

-- Backfill updatedat from createdat for existing rows
UPDATE orders SET updatedat = createdat WHERE updatedat IS NULL;

-- Update cancel RPC to set updatedat
CREATE OR REPLACE FUNCTION public.cancel_order_and_restore_stock(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  r record;
BEGIN
  SELECT status INTO v_status FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_status = 'cancelled' THEN RAISE EXCEPTION 'Order is already cancelled'; END IF;
  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Only pending/confirmed orders can be cancelled (status: %)', v_status;
  END IF;

  FOR r IN SELECT oi.productid, oi.quantity, oi.product_cost_snapshot
           FROM orderitems oi WHERE oi.orderid = p_order_id
  LOOP
    UPDATE products SET stock_on_hand = stock_on_hand + r.quantity WHERE id = r.productid;
    INSERT INTO inventory_movements (product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id)
    VALUES (r.productid, 'ADJUSTMENT', r.quantity, r.product_cost_snapshot, 'order_cancel', p_order_id);
  END LOOP;

  UPDATE orders SET status = 'cancelled', updatedat = now() WHERE id = p_order_id;
END;
$$;

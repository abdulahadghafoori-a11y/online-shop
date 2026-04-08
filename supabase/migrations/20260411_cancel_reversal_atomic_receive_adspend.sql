-- 1) Cancel-order stock reversal: re-credit stock_on_hand for each order item,
--    create ADJUSTMENT movements, then set status='cancelled'.
-- 2) Atomic PO receive: loop apply_stock_receipt inside one transaction.
-- 3) Proportional ad-spend allocation on orders.

-- ══════════════════════════════════════════════════════════════════════════════
-- reverse_order_stock: undo OUT movements, restore stock, set cancelled
-- ══════════════════════════════════════════════════════════════════════════════
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
  SELECT status INTO v_status
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_status = 'cancelled' THEN
    RAISE EXCEPTION 'Order is already cancelled';
  END IF;

  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Only pending/confirmed orders can be cancelled (status: %)', v_status;
  END IF;

  FOR r IN
    SELECT oi.productid, oi.quantity, oi.product_cost_snapshot
    FROM orderitems oi
    WHERE oi.orderid = p_order_id
  LOOP
    UPDATE products
    SET stock_on_hand = stock_on_hand + r.quantity
    WHERE id = r.productid;

    INSERT INTO inventory_movements (
      product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id
    ) VALUES (
      r.productid, 'ADJUSTMENT', r.quantity, r.product_cost_snapshot,
      'order_cancel', p_order_id
    );
  END LOOP;

  UPDATE orders SET status = 'cancelled' WHERE id = p_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_order_and_restore_stock(uuid)
  TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- receive_purchase_order: atomic receipt of all PO lines in one transaction
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.receive_purchase_order(p_po_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
  r record;
BEGIN
  SELECT status INTO v_status
  FROM purchase_orders
  WHERE id = p_po_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase order not found';
  END IF;
  IF v_status != 'draft' THEN
    RAISE EXCEPTION 'Only draft POs can be received (status: %)', v_status;
  END IF;

  FOR r IN
    SELECT product_id, quantity, unit_cost,
           base_cost, shipping_cost_per_unit, packaging_cost_per_unit
    FROM purchase_order_items
    WHERE purchase_order_id = p_po_id
  LOOP
    PERFORM public.apply_stock_receipt(
      r.product_id,
      GREATEST(1, round(r.quantity)::integer),
      r.base_cost,
      r.shipping_cost_per_unit,
      r.packaging_cost_per_unit,
      'purchase_order:' || p_po_id::text,
      CURRENT_DATE
    );
  END LOOP;

  UPDATE purchase_orders
  SET status = 'received', received_at = now()
  WHERE id = p_po_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid)
  TO authenticated, service_role;

-- ══════════════════════════════════════════════════════════════════════════════
-- allocate_ad_spend_for_order: proportional spend per campaign per day
-- Sets orders.allocatedadspend = campaign day-spend / day-orders-in-campaign
-- ══════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.allocate_ad_spend_for_order(p_order_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign uuid;
  v_date date;
  v_day_spend numeric;
  v_day_orders bigint;
  v_allocated numeric;
BEGIN
  SELECT campaignid, createdat::date
  INTO v_campaign, v_date
  FROM orders
  WHERE id = p_order_id;

  IF v_campaign IS NULL THEN
    UPDATE orders SET allocatedadspend = 0 WHERE id = p_order_id;
    RETURN 0;
  END IF;

  SELECT coalesce(sum(dai.spend), 0)
  INTO v_day_spend
  FROM daily_ad_insights dai
  WHERE dai.campaign_id = v_campaign
    AND dai.date = v_date;

  SELECT count(*)
  INTO v_day_orders
  FROM orders o
  WHERE o.campaignid = v_campaign
    AND o.createdat::date = v_date
    AND o.status != 'cancelled';

  IF v_day_orders <= 0 THEN
    v_allocated := 0;
  ELSE
    v_allocated := round(v_day_spend / v_day_orders, 2);
  END IF;

  UPDATE orders SET allocatedadspend = v_allocated WHERE id = p_order_id;
  RETURN v_allocated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.allocate_ad_spend_for_order(uuid)
  TO authenticated, service_role;

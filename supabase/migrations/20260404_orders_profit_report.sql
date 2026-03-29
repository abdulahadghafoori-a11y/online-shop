-- Order-level P&L rows for reporting (matches orderprofit() line math)

CREATE OR REPLACE FUNCTION public.orders_profit_report(datefrom text, dateto text)
RETURNS TABLE (
  order_id uuid,
  phone text,
  status text,
  created_at timestamptz,
  revenue numeric,
  cogs numeric,
  delivery_cost numeric,
  allocated_ad_spend numeric,
  profit numeric,
  line_items bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    o.id AS order_id,
    o.phone,
    o.status,
    o.createdat AS created_at,
    coalesce(sum(oi.saleprice * oi.quantity), 0) AS revenue,
    coalesce(sum(oi.product_cost_snapshot * oi.quantity), 0) AS cogs,
    coalesce(o.deliverycost, 0) AS delivery_cost,
    coalesce(o.allocatedadspend, 0) AS allocated_ad_spend,
    coalesce(sum(oi.saleprice * oi.quantity), 0)
      - coalesce(sum(oi.product_cost_snapshot * oi.quantity), 0)
      - coalesce(o.deliverycost, 0)
      - coalesce(o.allocatedadspend, 0) AS profit,
    coalesce(count(oi.id), 0)::bigint AS line_items
  FROM orders o
  LEFT JOIN orderitems oi ON oi.orderid = o.id
  WHERE o.createdat >= datefrom::timestamptz
    AND o.createdat < (dateto::date + interval '1 day')::timestamptz
    AND o.status != 'cancelled'
  GROUP BY o.id, o.phone, o.status, o.createdat, o.deliverycost, o.allocatedadspend
  ORDER BY o.createdat DESC;
$$;

GRANT EXECUTE ON FUNCTION public.orders_profit_report(text, text) TO authenticated, service_role;

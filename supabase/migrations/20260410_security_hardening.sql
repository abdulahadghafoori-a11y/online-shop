-- Security: remove anonymous inserts on clicks/leads (server uses service role on /w).
-- Ledger: inventory_movements + stock_receipts SELECT-only for authenticated (mutations via SECURITY DEFINER RPCs).
-- Atomic order: single transaction for order header + line items + stock.
-- Reporting: campaignprofitreport profit = sum(orderprofit) − spend (aligned with order-level P&L).

-- ── Remove anonymous click/lead inserts (/w uses service role; dashboard uses JWT) ──
DROP POLICY IF EXISTS "Public insert clicks" ON public.clicks;
DROP POLICY IF EXISTS "Authenticated insert clicks" ON public.clicks;

DROP POLICY IF EXISTS "Public insert leads" ON public.leads;
DROP POLICY IF EXISTS "Authenticated insert leads" ON public.leads;

-- ── Immutable ledger surface: read-only for JWT users ─────────────────────
DROP POLICY IF EXISTS "Auth access" ON public.inventory_movements;
CREATE POLICY "inventory_movements_select" ON public.inventory_movements
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Auth access" ON public.stock_receipts;
CREATE POLICY "stock_receipts_select" ON public.stock_receipts
  FOR SELECT TO authenticated
  USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.inventory_movements FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.stock_receipts FROM authenticated;

GRANT SELECT ON public.inventory_movements TO authenticated;
GRANT SELECT ON public.stock_receipts TO authenticated;

-- ── Atomic create order + apply items ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_order_and_apply_items(
  p_phone text,
  p_clickid text,
  p_adid uuid,
  p_adsetid uuid,
  p_campaignid uuid,
  p_deliveryaddress text,
  p_trackingnumber text,
  p_deliverycost numeric,
  p_status text,
  p_attributionmethod text,
  p_confidencescore numeric,
  p_allocatedadspend numeric,
  p_createdby uuid,
  p_items jsonb,
  p_allow_negative boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO orders (
    phone,
    clickid,
    adid,
    adsetid,
    campaignid,
    deliveryaddress,
    trackingnumber,
    deliverycost,
    status,
    attributionmethod,
    confidencescore,
    allocatedadspend,
    createdby
  ) VALUES (
    p_phone,
    p_clickid,
    p_adid,
    p_adsetid,
    p_campaignid,
    p_deliveryaddress,
    p_trackingnumber,
    p_deliverycost,
    p_status,
    p_attributionmethod,
    p_confidencescore,
    p_allocatedadspend,
    p_createdby
  )
  RETURNING id INTO v_id;

  PERFORM public.apply_order_sales_and_items(v_id, p_items, p_allow_negative);
  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_and_apply_items(
  text, text, uuid, uuid, uuid, text, text, numeric, text, text, numeric, numeric, uuid, jsonb, boolean
) TO authenticated, service_role;

-- ── Campaign report: contribution margin (orderprofit sum) − ad spend ─────
CREATE OR REPLACE FUNCTION public.campaignprofitreport(datefrom text, dateto text)
RETURNS TABLE (
  campaignid uuid,
  campaignname text,
  spend numeric,
  orders bigint,
  revenue numeric,
  profit numeric,
  roas numeric,
  cpa numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH spendagg AS (
    SELECT
      d.campaignid,
      coalesce(sum(d.spend), 0)::numeric AS totalspend
    FROM public.dailyadstats d
    WHERE d.date BETWEEN datefrom::date AND dateto::date
    GROUP BY d.campaignid
  ),
  ord_rows AS (
    SELECT
      o.campaignid,
      o.id AS order_id,
      coalesce((
        SELECT sum(oi.saleprice * oi.quantity)
        FROM public.orderitems oi
        WHERE oi.orderid = o.id
      ), 0) AS rev,
      public.orderprofit(o.id) AS contrib
    FROM public.orders o
    WHERE o.createdat >= datefrom::timestamptz
      AND o.createdat < (dateto::date + interval '1 day')::timestamptz
      AND o.status != 'cancelled'
  ),
  orderagg AS (
    SELECT
      r.campaignid,
      count(*)::bigint AS totalorders,
      coalesce(sum(r.rev), 0) AS totalrevenue,
      coalesce(sum(r.contrib), 0) AS contribution
    FROM ord_rows r
    GROUP BY r.campaignid
  )
  SELECT
    c.id AS campaignid,
    c.name AS campaignname,
    coalesce(s.totalspend, 0) AS spend,
    coalesce(a.totalorders, 0) AS orders,
    coalesce(a.totalrevenue, 0) AS revenue,
    coalesce(a.contribution, 0) - coalesce(s.totalspend, 0) AS profit,
    CASE
      WHEN coalesce(s.totalspend, 0) > 0
        THEN coalesce(a.totalrevenue, 0) / s.totalspend
      ELSE 0::numeric
    END AS roas,
    CASE
      WHEN coalesce(a.totalorders, 0) > 0
        THEN coalesce(s.totalspend, 0) / a.totalorders::numeric
      ELSE 0::numeric
    END AS cpa
  FROM public.campaigns c
  LEFT JOIN spendagg s ON s.campaignid = c.id
  LEFT JOIN orderagg a ON a.campaignid = c.id
  ORDER BY profit DESC NULLS LAST;
$$;

GRANT EXECUTE ON FUNCTION public.campaignprofitreport(text, text) TO authenticated, service_role;

-- Suppliers master list; purchase orders reference supplier_id.
-- Idempotent for DBs already migrated or created from updated schema.sql.

CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT suppliers_name_unique UNIQUE (name)
);

ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_id uuid REFERENCES public.suppliers (id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchase_orders'
      AND column_name = 'supplier_name'
  ) THEN
    INSERT INTO public.suppliers (name)
    SELECT DISTINCT TRIM(po.supplier_name)
    FROM public.purchase_orders po
    WHERE TRIM(po.supplier_name) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.suppliers s WHERE TRIM(s.name) = TRIM(po.supplier_name)
      );

    UPDATE public.purchase_orders po
    SET supplier_id = s.id
    FROM public.suppliers s
    WHERE po.supplier_id IS NULL
      AND TRIM(s.name) = TRIM(po.supplier_name);

    ALTER TABLE public.purchase_orders DROP COLUMN supplier_name;
  END IF;
END $$;

ALTER TABLE public.purchase_orders
  ALTER COLUMN supplier_id SET NOT NULL;

ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth access" ON public.suppliers;
CREATE POLICY "Auth access" ON public.suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;

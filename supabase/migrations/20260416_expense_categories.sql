-- Expense categories table
CREATE TABLE IF NOT EXISTS expense_categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT expense_categories_name_unique UNIQUE (name)
);

ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth access" ON expense_categories FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default categories
INSERT INTO expense_categories (name) VALUES
  ('Rent'),
  ('Salaries'),
  ('Fuel / Transport'),
  ('Packaging materials'),
  ('Internet / Phone'),
  ('Software / SaaS'),
  ('Office supplies'),
  ('Marketing (non-ad)'),
  ('Other')
ON CONFLICT (name) DO NOTHING;

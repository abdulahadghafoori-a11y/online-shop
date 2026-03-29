-- WhatsApp / Meta Sales OS — run in Supabase SQL editor (or migrate)
-- Extensions
create extension if not exists "uuid-ossp";

-- ── USERS (app profile linked to auth.users) ──────────────────
create table if not exists users (
  id         uuid primary key default uuid_generate_v4(),
  authid     uuid references auth.users (id) on delete cascade unique,
  name       text not null,
  role       text not null default 'salesagent'
    check (role in ('admin', 'manager', 'salesagent')),
  createdat  timestamptz default now()
);

-- ── PRODUCTS ─────────────────────────────────────────────────
create table if not exists products (
  id                 uuid primary key default uuid_generate_v4(),
  name               text not null,
  sku                text unique not null,
  defaultsaleprice   numeric(10, 2) not null default 0,
  isactive           boolean default true,
  avg_cost           numeric(12,6) not null default 0,
  stock_on_hand      integer not null default 0,
  createdat          timestamptz default now()
);

create table if not exists productcosts (
  id          uuid primary key default uuid_generate_v4(),
  productid   uuid references products (id) on delete cascade,
  unitcost    numeric(10, 2) not null,
  createdat   timestamptz default now()
);

create index if not exists idx_productcosts_productid on productcosts (productid);
create index if not exists idx_productcosts_createdat on productcosts (createdat);

-- ── AD HIERARCHY ─────────────────────────────────────────────
create table if not exists campaigns (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  platform    text not null default 'facebook'
    check (platform in ('facebook', 'instagram', 'other')),
  status      text not null default 'active'
    check (status in ('active', 'paused', 'stopped')),
  createdat   timestamptz default now()
);

create table if not exists adsets (
  id           uuid primary key default uuid_generate_v4(),
  campaignid   uuid references campaigns (id) on delete cascade,
  name         text not null,
  createdat    timestamptz default now()
);

create table if not exists ads (
  id          uuid primary key default uuid_generate_v4(),
  adsetid     uuid references adsets (id) on delete cascade,
  name        text not null,
  createdat   timestamptz default now()
);

-- ── CLICKS ───────────────────────────────────────────────────
create table if not exists clicks (
  id           uuid primary key default uuid_generate_v4(),
  clickid      text unique not null,
  fbclid       text,
  campaignid   uuid references campaigns (id) on delete set null,
  adsetid      uuid references adsets (id) on delete set null,
  adid         uuid references ads (id) on delete set null,
  utmsource    text,
  utmcampaign  text,
  utmcontent   text,
  ipaddress    text,
  useragent    text,
  devicetype   text default 'unknown'
    check (devicetype in ('mobile', 'tablet', 'desktop', 'unknown')),
  createdat    timestamptz default now()
);

create index if not exists idx_clicks_clickid on clicks (clickid);
create index if not exists idx_clicks_fbclid on clicks (fbclid);
create index if not exists idx_clicks_campaignid on clicks (campaignid);
create index if not exists idx_clicks_createdat on clicks (createdat);

-- ── LEADS ────────────────────────────────────────────────────
create table if not exists leads (
  id          uuid primary key default uuid_generate_v4(),
  clickid     text references clicks (clickid) on delete set null,
  adid        uuid references ads (id) on delete set null,
  phone       text,
  createdat   timestamptz default now()
);

create index if not exists idx_leads_phone on leads (phone);
create index if not exists idx_leads_clickid on leads (clickid);

-- ── ORDERS ───────────────────────────────────────────────────
create table if not exists orders (
  id                 uuid primary key default uuid_generate_v4(),
  leadid             uuid references leads (id) on delete set null,
  clickid            text references clicks (clickid) on delete set null,
  adid               uuid references ads (id) on delete set null,
  campaignid         uuid references campaigns (id) on delete set null,
  phone              text not null,
  deliveryaddress    text not null default 'Kabul',
  trackingnumber     text,
  deliverycost       numeric(10, 2) not null default 0,
  allocatedadspend   numeric(10, 2) default 0,
  status             text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  attributionmethod  text,
  confidencescore    numeric(3, 2) default 0,
  createdby          uuid references users (id) on delete set null,
  createdat          timestamptz default now()
);

create index if not exists idx_orders_clickid on orders (clickid);
create index if not exists idx_orders_phone on orders (phone);
create index if not exists idx_orders_campaignid on orders (campaignid);
create index if not exists idx_orders_createdat on orders (createdat);

create table if not exists orderitems (
  id          uuid primary key default uuid_generate_v4(),
  orderid     uuid references orders (id) on delete cascade,
  productid   uuid references products (id) on delete restrict,
  quantity    int not null default 1 check (quantity > 0),
  saleprice   numeric(10, 2) not null,
  unitcost    numeric(10, 2) not null,
  product_cost_snapshot numeric(12,6) not null default 0
);

create index if not exists idx_orderitems_orderid on orderitems (orderid);
create index if not exists idx_orderitems_productid on orderitems (productid);

-- ── INVENTORY ────────────────────────────────────────────────
create table if not exists purchases (
  id             uuid primary key default uuid_generate_v4(),
  suppliername   text,
  totalcost      numeric(10, 2),
  createdat      timestamptz default now()
);

create table if not exists purchaseitems (
  id           uuid primary key default uuid_generate_v4(),
  purchaseid   uuid references purchases (id) on delete cascade,
  productid    uuid references products (id) on delete restrict,
  quantity     int not null check (quantity > 0),
  unitcost     numeric(10, 2) not null
);

create table if not exists inventorytransactions (
  id            uuid primary key default uuid_generate_v4(),
  productid     uuid references products (id) on delete restrict,
  type          text not null check (type in ('purchase', 'sale', 'adjustment')),
  quantity      int not null,
  unitcost      numeric(10, 2),
  referenceid   uuid,
  createdat     timestamptz default now()
);

create index if not exists idx_inventory_productid on inventorytransactions (productid);
create index if not exists idx_inventory_type on inventorytransactions (type);

create or replace view inventorybalance as
select
  p.id as productid,
  p.name as productname,
  p.sku,
  p.stock_on_hand::bigint as stockonhand
from products p;

grant select on inventorybalance to authenticated;

-- ── AD SPEND ─────────────────────────────────────────────────
create table if not exists dailyadstats (
  id            uuid primary key default uuid_generate_v4(),
  campaignid    uuid references campaigns (id) on delete cascade,
  date          date not null,
  spend         numeric(10, 2) default 0,
  clicks        int default 0,
  impressions   int default 0,
  unique (campaignid, date)
);

create index if not exists idx_dailyadstats_date on dailyadstats (date);

-- ── EXPENSES ─────────────────────────────────────────────────
create table if not exists expenses (
  id        uuid primary key default uuid_generate_v4(),
  category  text not null,
  amount    numeric(10, 2) not null,
  date      date not null,
  notes     text
);

-- ── CONVERSION EVENTS (CAPI dedup) ───────────────────────────
create table if not exists conversionevents (
  id            uuid primary key default uuid_generate_v4(),
  orderid       uuid references orders (id) on delete cascade,
  eventtype     text not null check (eventtype in ('InitiateCheckout', 'Purchase')),
  value         numeric(10, 2),
  status        text not null default 'pending'
    check (status in ('pending', 'sent', 'failed')),
  sentat        timestamptz,
  metaresponse  text
);

create unique index if not exists idx_conversion_dedup
  on conversionevents (orderid, eventtype)
  where status = 'sent';

-- ── DELIVERY ZONES ───────────────────────────────────────────
create table if not exists deliveryzones (
  id             uuid primary key default uuid_generate_v4(),
  city           text unique not null,
  deliverycost   numeric(10, 2) not null default 0
);

-- ── RLS ──────────────────────────────────────────────────────
alter table users enable row level security;
alter table products enable row level security;
alter table productcosts enable row level security;
alter table campaigns enable row level security;
alter table adsets enable row level security;
alter table ads enable row level security;
alter table clicks enable row level security;
alter table leads enable row level security;
alter table orders enable row level security;
alter table orderitems enable row level security;
alter table purchases enable row level security;
alter table purchaseitems enable row level security;
alter table inventorytransactions enable row level security;
alter table dailyadstats enable row level security;
alter table expenses enable row level security;
alter table conversionevents enable row level security;
alter table deliveryzones enable row level security;

-- Authenticated users: full access (policies are OR’d)
do $$
declare
  t text;
begin
  foreach t in array array[
    'users', 'products', 'productcosts', 'campaigns', 'adsets', 'ads',
    'clicks', 'leads', 'orders', 'orderitems', 'purchases', 'purchaseitems',
    'inventorytransactions', 'dailyadstats', 'expenses',
    'conversionevents', 'deliveryzones'
  ]
  loop
    execute format(
      'drop policy if exists "Auth access" on %I',
      t
    );
    execute format(
      'create policy "Auth access" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;

drop policy if exists "Public insert clicks" on clicks;
create policy "Public insert clicks" on clicks
  for insert to anon, authenticated with check (true);

drop policy if exists "Public insert leads" on leads;
create policy "Public insert leads" on leads
  for insert to anon, authenticated with check (true);

-- ── FUNCTIONS ────────────────────────────────────────────────
create or replace function getunitcost(p_productid uuid, p_at timestamptz default now())
returns numeric
language sql
stable
as $$
  select avg_cost from products where id = p_productid;
$$;

create or replace function orderprofit(p_orderid uuid)
returns numeric
language sql
stable
as $$
  select
    coalesce(sum(oi.saleprice * oi.quantity), 0)
    - coalesce(sum(oi.product_cost_snapshot * oi.quantity), 0)
    - coalesce(max(o.deliverycost), 0)
    - coalesce(max(o.allocatedadspend), 0)
  from orders o
  join orderitems oi on oi.orderid = o.id
  where o.id = p_orderid;
$$;

create or replace function campaignprofitreport(datefrom text, dateto text)
returns table (
  campaignid   uuid,
  campaignname text,
  spend        numeric,
  orders       bigint,
  revenue      numeric,
  profit       numeric,
  roas         numeric,
  cpa          numeric
)
language sql
stable
as $$
  with spendagg as (
    select campaignid, coalesce(sum(spend), 0) as totalspend
    from dailyadstats
    where date between datefrom::date and dateto::date
    group by campaignid
  ),
  orderagg as (
    select
      o.campaignid,
      count(distinct o.id) as totalorders,
      coalesce(sum(oi.saleprice * oi.quantity), 0) as totalrevenue
    from orders o
    join orderitems oi on oi.orderid = o.id
    where o.createdat >= datefrom::timestamptz
      and o.createdat < (dateto::date + interval '1 day')::timestamptz
      and o.status != 'cancelled'
    group by o.campaignid
  )
  select
    c.id as campaignid,
    c.name as campaignname,
    coalesce(s.totalspend, 0) as spend,
    coalesce(a.totalorders, 0) as orders,
    coalesce(a.totalrevenue, 0) as revenue,
    coalesce(a.totalrevenue, 0) - coalesce(s.totalspend, 0) as profit,
    case when coalesce(s.totalspend, 0) > 0
      then coalesce(a.totalrevenue, 0) / s.totalspend
      else 0 end as roas,
    case when coalesce(a.totalorders, 0) > 0
      then coalesce(s.totalspend, 0) / a.totalorders
      else 0 end as cpa
  from campaigns c
  left join spendagg s on s.campaignid = c.id
  left join orderagg a on a.campaignid = c.id
  order by profit desc nulls last;
$$;

create or replace function productprofitreport(datefrom text, dateto text)
returns table (
  productid    uuid,
  productname  text,
  unitssold    bigint,
  revenue      numeric,
  cost         numeric,
  profit       numeric
)
language sql
stable
as $$
  select
    p.id as productid,
    p.name as productname,
    coalesce(sum(oi.quantity), 0)::bigint as unitssold,
    coalesce(sum(oi.saleprice * oi.quantity), 0) as revenue,
    coalesce(sum(oi.product_cost_snapshot * oi.quantity), 0) as cost,
    coalesce(sum((oi.saleprice - oi.product_cost_snapshot) * oi.quantity), 0) as profit
  from products p
  left join orderitems oi on oi.productid = p.id
  left join orders o on o.id = oi.orderid
    and o.createdat >= datefrom::timestamptz
    and o.createdat < (dateto::date + interval '1 day')::timestamptz
    and o.status != 'cancelled'
  group by p.id, p.name
  order by profit desc nulls last;
$$;

grant execute on function campaignprofitreport(text, text) to authenticated, service_role;
grant execute on function productprofitreport(text, text) to authenticated, service_role;
grant execute on function getunitcost(uuid, timestamptz) to authenticated, service_role;
grant execute on function orderprofit(uuid) to authenticated, service_role;

create or replace function public.orders_profit_report(datefrom text, dateto text)
returns table (
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
language sql
stable
set search_path = public
as $$
  select
    o.id as order_id,
    o.phone,
    o.status,
    o.createdat as created_at,
    coalesce(sum(oi.saleprice * oi.quantity), 0) as revenue,
    coalesce(sum(oi.product_cost_snapshot * oi.quantity), 0) as cogs,
    coalesce(o.deliverycost, 0) as delivery_cost,
    coalesce(o.allocatedadspend, 0) as allocated_ad_spend,
    coalesce(sum(oi.saleprice * oi.quantity), 0)
      - coalesce(sum(oi.product_cost_snapshot * oi.quantity), 0)
      - coalesce(o.deliverycost, 0)
      - coalesce(o.allocatedadspend, 0) as profit,
    coalesce(count(oi.id), 0)::bigint as line_items
  from orders o
  left join orderitems oi on oi.orderid = o.id
  where o.createdat >= datefrom::timestamptz
    and o.createdat < (dateto::date + interval '1 day')::timestamptz
    and o.status != 'cancelled'
  group by o.id, o.phone, o.status, o.createdat, o.deliverycost, o.allocatedadspend
  order by o.createdat desc;
$$;

grant execute on function orders_profit_report(text, text) to authenticated, service_role;

-- ── META EVENT LOGS (CAPI audit) + PURCHASE ORDERS + STOCK ADJ (migrations 20260327+) ──

create table if not exists meta_event_logs (
  id            uuid primary key default gen_random_uuid(),
  order_id      uuid references orders(id) on delete set null,
  click_id      text,
  event_name    text not null,
  event_id      text not null,
  payload       jsonb,
  test_mode     boolean not null default false,
  status        text not null default 'pending'
    check (status in ('pending','sent','failed','skipped')),
  meta_response jsonb,
  sent_at       timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_meta_event_logs_order on meta_event_logs(order_id);
create index if not exists idx_meta_event_logs_event on meta_event_logs(event_id);
create unique index if not exists uq_meta_event_logs_dedup
  on meta_event_logs(event_name, event_id)
  where status = 'sent';

create table if not exists purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  supplier_name  text not null,
  status         text not null default 'draft'
    check (status in ('draft','received','cancelled')),
  notes          text,
  created_by     uuid references users(id),
  created_at     timestamptz not null default now(),
  received_at    timestamptz
);

create table if not exists purchase_order_items (
  id                 uuid primary key default gen_random_uuid(),
  purchase_order_id  uuid not null references purchase_orders(id) on delete cascade,
  product_id         uuid not null references products(id),
  quantity           numeric(12,2) not null check (quantity > 0),
  unit_cost          numeric(12,6) not null check (unit_cost >= 0),
  base_cost                     numeric(12,6) not null default 0,
  shipping_cost_per_unit        numeric(12,6) not null default 0,
  packaging_cost_per_unit       numeric(12,6) not null default 0,
  created_at         timestamptz not null default now()
);

create index if not exists idx_poi_purchase on purchase_order_items(purchase_order_id);
create index if not exists idx_poi_product on purchase_order_items(product_id);

create table if not exists stock_adjustments (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references products(id),
  quantity    int not null check (quantity <> 0),
  reason      text not null,
  created_by  uuid references users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_stock_adj_product on stock_adjustments(product_id);

alter table meta_event_logs enable row level security;
alter table purchase_orders enable row level security;
alter table purchase_order_items enable row level security;
alter table stock_adjustments enable row level security;

drop policy if exists "Auth access" on meta_event_logs;
create policy "Auth access" on meta_event_logs
  for all to authenticated using (true) with check (true);

drop policy if exists "Auth access" on purchase_orders;
create policy "Auth access" on purchase_orders
  for all to authenticated using (true) with check (true);

drop policy if exists "Auth access" on purchase_order_items;
create policy "Auth access" on purchase_order_items
  for all to authenticated using (true) with check (true);

drop policy if exists "Auth access" on stock_adjustments;
create policy "Auth access" on stock_adjustments
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on meta_event_logs to authenticated;
grant select, insert, update, delete on purchase_orders to authenticated;
grant select, insert, update, delete on purchase_order_items to authenticated;
grant select, insert, update, delete on stock_adjustments to authenticated;

-- ── WAC inventory (atomic stock + average cost; see migration 20260401_wac_inventory.sql) ──
create table if not exists stock_receipts (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  qty_received integer not null check (qty_received > 0),
  unit_cost numeric(14,6) not null check (unit_cost >= 0),
  base_cost numeric(14,6) not null default 0,
  shipping_cost_per_unit numeric(14,6) not null default 0,
  packaging_cost_per_unit numeric(14,6) not null default 0,
  total_cost numeric(18,6) generated always as ((qty_received::numeric * unit_cost)) stored,
  received_date date not null default (current_date),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_stock_receipts_product on stock_receipts(product_id);
create index if not exists idx_stock_receipts_received_date on stock_receipts(received_date desc);

create table if not exists inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  movement_type text not null check (movement_type in ('IN', 'OUT', 'ADJUSTMENT')),
  qty integer not null check (qty <> 0),
  unit_cost_snapshot numeric(14,6),
  reference_type text,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists idx_inventory_movements_product on inventory_movements(product_id);
create index if not exists idx_inventory_movements_created on inventory_movements(created_at desc);

create or replace function public.apply_stock_receipt(
  p_product_id uuid,
  p_qty integer,
  p_base_cost numeric,
  p_shipping_cost_per_unit numeric,
  p_packaging_cost_per_unit numeric,
  p_notes text default null,
  p_received_date date default current_date
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
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
begin
  if p_qty <= 0 then
    raise exception 'qty must be positive';
  end if;

  v_base := round(coalesce(p_base_cost, 0)::numeric, 6);
  v_ship := round(coalesce(p_shipping_cost_per_unit, 0)::numeric, 6);
  v_pack := round(coalesce(p_packaging_cost_per_unit, 0)::numeric, 6);

  if v_base < 0 or v_ship < 0 or v_pack < 0 then
    raise exception 'cost components cannot be negative';
  end if;

  v_unit := round(v_base + v_ship + v_pack, 6);

  select stock_on_hand, avg_cost
    into v_stock, v_avg
  from products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'product not found';
  end if;

  v_existing_val := v_stock::numeric * v_avg;
  v_new_val := p_qty::numeric * v_unit;
  v_new_stock := v_stock + p_qty;

  if v_new_stock > 0 then
    v_new_avg := (v_existing_val + v_new_val) / v_new_stock::numeric;
  else
    v_new_avg := v_avg;
  end if;

  update products
  set stock_on_hand = v_new_stock,
      avg_cost = round(v_new_avg::numeric, 6)
  where id = p_product_id;

  insert into stock_receipts (
    product_id,
    qty_received,
    unit_cost,
    base_cost,
    shipping_cost_per_unit,
    packaging_cost_per_unit,
    received_date,
    notes
  ) values (
    p_product_id,
    p_qty,
    v_unit,
    v_base,
    v_ship,
    v_pack,
    p_received_date,
    p_notes
  )
  returning id into v_receipt_id;

  insert into inventory_movements (
    product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id
  ) values (
    p_product_id, 'IN', p_qty, v_unit, 'receipt', v_receipt_id
  );

  return jsonb_build_object(
    'receipt_id', v_receipt_id,
    'new_avg_cost', round(v_new_avg::numeric, 6),
    'new_stock', v_new_stock
  );
end;
$$;

create or replace function public.apply_order_sales_and_items(
  p_order_id uuid,
  p_items jsonb,
  p_allow_negative boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_stock integer;
  v_avg numeric(14,6);
  v_snap numeric(14,6);
begin
  for r in
    select *
    from jsonb_to_recordset(p_items) as t(
      productid uuid,
      quantity integer,
      saleprice numeric
    )
  loop
    if r.quantity is null or r.quantity <= 0 then
      raise exception 'invalid quantity';
    end if;

    select stock_on_hand, avg_cost
      into v_stock, v_avg
    from products
    where id = r.productid
    for update;

    if not found then
      raise exception 'product not found: %', r.productid;
    end if;

    v_snap := round(coalesce(v_avg, 0)::numeric, 6);

    if not p_allow_negative and v_stock < r.quantity then
      raise exception 'INSUFFICIENT_STOCK:%', r.productid;
    end if;

    insert into orderitems (
      orderid, productid, quantity, saleprice, unitcost, product_cost_snapshot
    ) values (
      p_order_id, r.productid, r.quantity, r.saleprice, v_snap, v_snap
    );

    update products
    set stock_on_hand = stock_on_hand - r.quantity
    where id = r.productid;

    insert into inventory_movements (
      product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id
    ) values (
      r.productid, 'OUT', r.quantity, v_snap, 'order', p_order_id
    );
  end loop;
end;
$$;

create or replace function public.apply_inventory_adjustment(
  p_product_id uuid,
  p_qty_delta integer,
  p_reference_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stock integer;
begin
  if p_qty_delta = 0 then
    raise exception 'adjustment qty cannot be zero';
  end if;

  select stock_on_hand into v_stock
  from products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'product not found';
  end if;

  update products
  set stock_on_hand = stock_on_hand + p_qty_delta
  where id = p_product_id;

  insert into inventory_movements (
    product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id
  ) values (
    p_product_id, 'ADJUSTMENT', p_qty_delta, null, 'adjustment', p_reference_id
  );

  return jsonb_build_object(
    'new_stock',
    (select stock_on_hand from products where id = p_product_id)
  );
end;
$$;

grant execute on function public.apply_stock_receipt(uuid, integer, numeric, numeric, numeric, text, date) to authenticated, service_role;
grant execute on function public.apply_order_sales_and_items(uuid, jsonb, boolean) to authenticated, service_role;
grant execute on function public.apply_inventory_adjustment(uuid, integer, uuid) to authenticated, service_role;

alter table stock_receipts enable row level security;
alter table inventory_movements enable row level security;

drop policy if exists "Auth access" on stock_receipts;
create policy "Auth access" on stock_receipts
  for all to authenticated using (true) with check (true);

drop policy if exists "Auth access" on inventory_movements;
create policy "Auth access" on inventory_movements
  for all to authenticated using (true) with check (true);

grant select, insert, update, delete on stock_receipts to authenticated;
grant select, insert, update, delete on inventory_movements to authenticated;
</think>


<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Read

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
  wa_message         text,
  description        text,
  image_url          text,
  reorder_point      integer not null default 0,
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
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  platform        text not null default 'facebook'
    check (platform in ('facebook', 'instagram', 'other')),
  status          text not null default 'active'
    check (status in ('active', 'paused', 'stopped')),
  metacampaignid  text,
  createdat       timestamptz default now()
);

create unique index if not exists idx_campaigns_metacampaignid
  on campaigns (metacampaignid) where metacampaignid is not null;

create table if not exists adsets (
  id           uuid primary key default uuid_generate_v4(),
  campaignid   uuid references campaigns (id) on delete cascade,
  name         text not null,
  metaadsetid  text,
  createdat    timestamptz default now()
);

create unique index if not exists idx_adsets_metaadsetid
  on adsets (metaadsetid) where metaadsetid is not null;

create table if not exists ads (
  id          uuid primary key default uuid_generate_v4(),
  adsetid     uuid references adsets (id) on delete cascade,
  name        text not null,
  metaadid    text,
  createdat   timestamptz default now()
);

create unique index if not exists idx_ads_metaadid
  on ads (metaadid) where metaadid is not null;

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
  product      text,
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
  adsetid            uuid references adsets (id) on delete set null,
  campaignid         uuid references campaigns (id) on delete set null,
  phone              text not null,
  deliveryaddress    text not null default 'Kabul',
  trackingnumber     text,
  deliverycost       numeric(10, 2) not null default 0,
  allocatedadspend   numeric(10, 2) default 0,
  meta_sent          boolean not null default false,
  status             text not null default 'pending'
    check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  attributionmethod  text,
  confidencescore    numeric(3, 2) default 0,
  createdby          uuid references users (id) on delete set null,
  notes              text,
  createdat          timestamptz default now(),
  updatedat          timestamptz
);

create index if not exists idx_orders_meta_sent on orders (meta_sent) where meta_sent = false;

create index if not exists idx_orders_clickid on orders (clickid);
create index if not exists idx_orders_phone on orders (phone);
create index if not exists idx_orders_campaignid on orders (campaignid);
create index if not exists idx_orders_adsetid on orders (adsetid);
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
grant select on dailyadstats to authenticated, anon;

-- ── AD SPEND (granular: campaign / adset / ad per day) ───────
create table if not exists daily_ad_insights (
  id            uuid primary key default gen_random_uuid(),
  date          date not null,
  campaign_id   uuid not null references campaigns(id) on delete cascade,
  adset_id      uuid references adsets(id) on delete cascade,
  ad_id         uuid references ads(id) on delete cascade,
  spend         numeric(14, 2) not null default 0,
  clicks        int not null default 0,
  impressions   bigint not null default 0,
  extra         jsonb not null default '{}'::jsonb,
  source        text not null default 'manual',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  dedupe_key    text not null generated always as (
    case
      when ad_id is not null then 'a|' || ad_id::text || '|' || (date - date '1970-01-01')::text
      when adset_id is not null then 's|' || adset_id::text || '|' || (date - date '1970-01-01')::text
      else 'c|' || campaign_id::text || '|' || (date - date '1970-01-01')::text
    end
  ) stored,
  constraint daily_ad_insights_ad_requires_adset
    check (ad_id is null or adset_id is not null)
);

create unique index if not exists idx_daily_ad_insights_dedupe_key
  on daily_ad_insights (dedupe_key);
create index if not exists idx_daily_ad_insights_campaign_date
  on daily_ad_insights (campaign_id, date);
create index if not exists idx_daily_ad_insights_date
  on daily_ad_insights (date);

-- Backward-compatible rollup view (campaign grain)
create or replace view dailyadstats as
select
  dai.campaign_id as campaignid,
  dai.date,
  sum(dai.spend)::numeric(14, 2) as spend,
  sum(dai.clicks)::int as clicks,
  least(coalesce(sum(dai.impressions), 0), 2147483647::numeric)::int as impressions
from daily_ad_insights dai
group by dai.campaign_id, dai.date;

-- ── EXPENSE CATEGORIES ───────────────────────────────────────
create table if not exists expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now(),
  constraint expense_categories_name_unique unique (name)
);

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
alter table daily_ad_insights enable row level security;
alter table expenses enable row level security;
alter table suppliers enable row level security;
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
    'inventorytransactions', 'daily_ad_insights', 'expenses', 'suppliers',
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
drop policy if exists "Public insert leads" on leads;
-- Anon cannot insert clicks/leads; /w uses service role; dashboard uses authenticated "Auth access".

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
set search_path = public
as $$
  with spendagg as (
    select campaignid, coalesce(sum(spend), 0) as totalspend
    from dailyadstats
    where date between datefrom::date and dateto::date
    group by campaignid
  ),
  ord_rows as (
    select
      o.campaignid,
      o.id as order_id,
      coalesce((
        select sum(oi.saleprice * oi.quantity)
        from orderitems oi
        where oi.orderid = o.id
      ), 0) as rev,
      orderprofit(o.id) as contrib
    from orders o
    where o.createdat >= datefrom::timestamptz
      and o.createdat < (dateto::date + interval '1 day')::timestamptz
      and o.status != 'cancelled'
  ),
  orderagg as (
    select
      r.campaignid,
      count(*)::bigint as totalorders,
      coalesce(sum(r.rev), 0) as totalrevenue,
      coalesce(sum(r.contrib), 0) as contribution
    from ord_rows r
    group by r.campaignid
  )
  select
    c.id as campaignid,
    c.name as campaignname,
    coalesce(s.totalspend, 0) as spend,
    coalesce(a.totalorders, 0) as orders,
    coalesce(a.totalrevenue, 0) as revenue,
    coalesce(a.contribution, 0) - coalesce(s.totalspend, 0) as profit,
    case when coalesce(s.totalspend, 0) > 0
      then coalesce(a.totalrevenue, 0) / s.totalspend
      else 0::numeric end as roas,
    case when coalesce(a.totalorders, 0) > 0
      then coalesce(s.totalspend, 0) / a.totalorders::numeric
      else 0::numeric end as cpa
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

create table if not exists suppliers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  constraint suppliers_name_unique unique (name)
);

create table if not exists purchase_orders (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid not null references suppliers(id),
  status          text not null default 'draft'
    check (status in ('draft','received','cancelled')),
  notes           text,
  created_by      uuid references users(id),
  created_at      timestamptz not null default now(),
  received_at     timestamptz,
  fx_afn_per_usd  numeric(14,6),
  fx_cny_per_usd  numeric(14,6)
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

create or replace function public.create_order_and_apply_items(
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
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into orders (
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
  ) values (
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
  returning id into v_id;

  perform public.apply_order_sales_and_items(v_id, p_items, p_allow_negative);
  return v_id;
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
grant execute on function public.create_order_and_apply_items(
  text, text, uuid, uuid, uuid, text, text, numeric, text, text, numeric, numeric, uuid, jsonb, boolean
) to authenticated, service_role;
grant execute on function public.apply_inventory_adjustment(uuid, integer, uuid) to authenticated, service_role;

alter table stock_receipts enable row level security;
alter table inventory_movements enable row level security;

drop policy if exists "Auth access" on stock_receipts;
drop policy if exists "stock_receipts_select" on stock_receipts;
create policy "stock_receipts_select" on stock_receipts
  for select to authenticated using (true);

drop policy if exists "Auth access" on inventory_movements;
drop policy if exists "inventory_movements_select" on inventory_movements;
create policy "inventory_movements_select" on inventory_movements
  for select to authenticated using (true);

revoke insert, update, delete on stock_receipts from authenticated;
revoke insert, update, delete on inventory_movements from authenticated;
grant select on stock_receipts to authenticated;
grant select on inventory_movements to authenticated;

-- ── Cancel order with stock reversal ─────────────────────────
create or replace function public.cancel_order_and_restore_stock(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  r record;
begin
  select status into v_status from orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_status = 'cancelled' then raise exception 'Order is already cancelled'; end if;
  if v_status not in ('pending', 'confirmed') then
    raise exception 'Only pending/confirmed orders can be cancelled (status: %)', v_status;
  end if;

  for r in select oi.productid, oi.quantity, oi.product_cost_snapshot
           from orderitems oi where oi.orderid = p_order_id
  loop
    update products set stock_on_hand = stock_on_hand + r.quantity where id = r.productid;
    insert into inventory_movements (product_id, movement_type, qty, unit_cost_snapshot, reference_type, reference_id)
    values (r.productid, 'ADJUSTMENT', r.quantity, r.product_cost_snapshot, 'order_cancel', p_order_id);
  end loop;

  update orders set status = 'cancelled', updatedat = now() where id = p_order_id;
end;
$$;

grant execute on function public.cancel_order_and_restore_stock(uuid) to authenticated, service_role;

-- ── Atomic PO receive ────────────────────────────────────────
create or replace function public.receive_purchase_order(p_po_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status text;
  r record;
begin
  select status into v_status from purchase_orders where id = p_po_id for update;
  if not found then raise exception 'Purchase order not found'; end if;
  if v_status != 'draft' then
    raise exception 'Only draft POs can be received (status: %)', v_status;
  end if;

  for r in select product_id, quantity, base_cost, shipping_cost_per_unit, packaging_cost_per_unit
           from purchase_order_items where purchase_order_id = p_po_id
  loop
    perform public.apply_stock_receipt(
      r.product_id,
      greatest(1, round(r.quantity)::integer),
      r.base_cost,
      r.shipping_cost_per_unit,
      r.packaging_cost_per_unit,
      'purchase_order:' || p_po_id::text,
      current_date
    );
  end loop;

  update purchase_orders set status = 'received', received_at = now() where id = p_po_id;
end;
$$;

grant execute on function public.receive_purchase_order(uuid) to authenticated, service_role;

-- ── Proportional ad-spend allocation ─────────────────────────
create or replace function public.allocate_ad_spend_for_order(p_order_id uuid)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign uuid;
  v_date date;
  v_day_spend numeric;
  v_day_orders bigint;
  v_allocated numeric;
begin
  select campaignid, createdat::date into v_campaign, v_date
  from orders where id = p_order_id;

  if v_campaign is null then
    update orders set allocatedadspend = 0 where id = p_order_id;
    return 0;
  end if;

  select coalesce(sum(dai.spend), 0) into v_day_spend
  from daily_ad_insights dai
  where dai.campaign_id = v_campaign and dai.date = v_date;

  select count(*) into v_day_orders
  from orders o
  where o.campaignid = v_campaign and o.createdat::date = v_date and o.status != 'cancelled';

  if v_day_orders <= 0 then v_allocated := 0;
  else v_allocated := round(v_day_spend / v_day_orders, 2);
  end if;

  update orders set allocatedadspend = v_allocated where id = p_order_id;
  return v_allocated;
end;
$$;

grant execute on function public.allocate_ad_spend_for_order(uuid) to authenticated, service_role;

-- ── Batch ad-spend re-allocation (campaign + day) ────────────
create or replace function public.reallocate_campaign_day_ad_spend(
  p_campaign_id uuid,
  p_date date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day_spend numeric;
  v_day_orders bigint;
  v_allocated numeric;
begin
  if p_campaign_id is null then return; end if;

  select coalesce(sum(dai.spend), 0) into v_day_spend
  from daily_ad_insights dai
  where dai.campaign_id = p_campaign_id and dai.date = p_date;

  select count(*) into v_day_orders
  from orders o
  where o.campaignid = p_campaign_id
    and o.createdat::date = p_date
    and o.status != 'cancelled';

  if v_day_orders <= 0 then v_allocated := 0;
  else v_allocated := round(v_day_spend / v_day_orders, 2);
  end if;

  update orders
  set allocatedadspend = v_allocated
  where campaignid = p_campaign_id
    and createdat::date = p_date
    and status != 'cancelled';
end;
$$;

grant execute on function public.reallocate_campaign_day_ad_spend(uuid, date) to authenticated, service_role;


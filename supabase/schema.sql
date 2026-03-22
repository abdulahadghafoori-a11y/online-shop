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
  unitcost    numeric(10, 2) not null
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
  coalesce(sum(t.quantity), 0)::bigint as stockonhand
from products p
left join inventorytransactions t on t.productid = p.id
group by p.id, p.name, p.sku;

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
  select unitcost
  from productcosts
  where productid = p_productid
    and createdat <= p_at
  order by createdat desc
  limit 1;
$$;

create or replace function orderprofit(p_orderid uuid)
returns numeric
language sql
stable
as $$
  select
    coalesce(sum(oi.saleprice * oi.quantity), 0)
    - coalesce(sum(oi.unitcost * oi.quantity), 0)
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
    coalesce(sum(oi.quantity), 0) as unitssold,
    coalesce(sum(oi.saleprice * oi.quantity), 0) as revenue,
    coalesce(sum(oi.unitcost * oi.quantity), 0) as cost,
    coalesce(sum((oi.saleprice - oi.unitcost) * oi.quantity), 0) as profit
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

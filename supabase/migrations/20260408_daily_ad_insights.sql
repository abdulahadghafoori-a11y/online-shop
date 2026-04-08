-- Unified daily insights: campaign / ad set / ad grains.
-- Replaces table dailyadstats with view dailyadstats (rollup) for backward compatibility.

create table if not exists public.daily_ad_insights (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  adset_id uuid references public.adsets(id) on delete cascade,
  ad_id uuid references public.ads(id) on delete cascade,
  spend numeric(14, 2) not null default 0,
  clicks int not null default 0,
  impressions bigint not null default 0,
  extra jsonb not null default '{}'::jsonb,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  dedupe_key text not null generated always as (
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
  on public.daily_ad_insights (dedupe_key);

create index if not exists idx_daily_ad_insights_campaign_date
  on public.daily_ad_insights (campaign_id, date);

create index if not exists idx_daily_ad_insights_date
  on public.daily_ad_insights (date);

-- Backfill from legacy base table when present (schema.sql / older DBs).
do $mv$
begin
  if exists (
    select 1
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_name = 'dailyadstats'
      and t.table_type = 'BASE TABLE'
  ) then
    insert into public.daily_ad_insights (
      campaign_id,
      adset_id,
      ad_id,
      date,
      spend,
      clicks,
      impressions,
      extra,
      source
    )
    select
      d.campaignid,
      null,
      null,
      d.date,
      d.spend,
      d.clicks,
      coalesce(d.impressions, 0)::bigint,
      '{}'::jsonb,
      'migrated'
    from public.dailyadstats d;
  end if;
end $mv$;

-- Spend aggregation for profit report (must run before dropping dailyadstats).
create or replace function public.campaignprofitreport(datefrom text, dateto text)
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
    select
      dai.campaign_id,
      coalesce(sum(dai.spend), 0)::numeric as totalspend
    from public.daily_ad_insights dai
    where dai.date between datefrom::date and dateto::date
    group by dai.campaign_id
  ),
  orderagg as (
    select
      o.campaignid,
      count(distinct o.id) as totalorders,
      coalesce(sum(oi.saleprice * oi.quantity), 0) as totalrevenue
    from public.orders o
    join public.orderitems oi on oi.orderid = o.id
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
  from public.campaigns c
  left join spendagg s on s.campaign_id = c.id
  left join orderagg a on a.campaignid = c.id
  order by profit desc nulls last;
$$;

-- Legacy installs have dailyadstats as a TABLE; after this migration it becomes a VIEW.
-- DROP VIEW ... on a table raises 42809; drop by relkind instead.
do $dropdaily$
declare
  k "char";
begin
  select c.relkind
    into k
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'dailyadstats';
  if k is null then
    return;
  elsif k = 'r' then
    execute 'drop table public.dailyadstats cascade';
  elsif k = 'v' then
    execute 'drop view public.dailyadstats cascade';
  elsif k = 'm' then
    execute 'drop materialized view public.dailyadstats cascade';
  end if;
end $dropdaily$;

create or replace view public.dailyadstats as
select
  agg.campaignid,
  agg.date,
  agg.spend,
  agg.clicks,
  agg.impressions
from (
  select
    dai.campaign_id as campaignid,
    dai.date,
    sum(dai.spend)::numeric(14, 2) as spend,
    sum(dai.clicks)::int as clicks,
    least(coalesce(sum(dai.impressions), 0), 2147483647::numeric)::int as impressions
  from public.daily_ad_insights dai
  group by dai.campaign_id, dai.date
) agg;

grant select on public.dailyadstats to authenticated;
grant select on public.dailyadstats to anon;

alter table public.daily_ad_insights enable row level security;

drop policy if exists "Auth access" on public.daily_ad_insights;
create policy "Auth access" on public.daily_ad_insights
  for all to authenticated
  using (true)
  with check (true);

grant select, insert, update, delete on public.daily_ad_insights to authenticated;
grant all on public.daily_ad_insights to service_role;

grant execute on function public.campaignprofitreport(text, text) to authenticated;
grant execute on function public.campaignprofitreport(text, text) to service_role;

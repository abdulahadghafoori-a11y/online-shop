-- Denormalized ad set on orders for reporting (derived from click / ad at order time).
alter table public.orders
  add column if not exists adsetid uuid references public.adsets (id) on delete set null;

create index if not exists idx_orders_adsetid on public.orders (adsetid);

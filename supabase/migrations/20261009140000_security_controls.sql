-- Restrict product and price data to people actively tracking that product.
drop policy if exists "Authenticated users can read canonical products" on public.products;
drop policy if exists "Authenticated users can read product sources" on public.product_sources;
drop policy if exists "Authenticated users can read price history" on public.price_history;
drop policy if exists "Users can view recommendations for tracked products" on public.recommendations;

create policy "Users can read products they actively track"
on public.products for select to authenticated
using (
  exists (
    select 1 from public.tracked_products
    where tracked_products.product_id = products.id
      and tracked_products.user_id = (select auth.uid())
      and tracked_products.is_active = true
  )
);

create policy "Users can read sources for actively tracked products"
on public.product_sources for select to authenticated
using (
  exists (
    select 1 from public.tracked_products
    where tracked_products.product_id = product_sources.product_id
      and tracked_products.user_id = (select auth.uid())
      and tracked_products.is_active = true
  )
);

create policy "Users can read history for actively tracked products"
on public.price_history for select to authenticated
using (
  exists (
    select 1
    from public.product_sources
    join public.tracked_products on tracked_products.product_id = product_sources.product_id
    where product_sources.id = price_history.product_source_id
      and tracked_products.user_id = (select auth.uid())
      and tracked_products.is_active = true
  )
);

create policy "Users can read recommendations for actively tracked products"
on public.recommendations for select to authenticated
using (
  exists (
    select 1 from public.tracked_products
    where tracked_products.product_id = recommendations.product_id
      and tracked_products.user_id = (select auth.uid())
      and tracked_products.is_active = true
  )
);

-- A compact sliding-window counter, called only with the service role by
-- server actions. It keeps expensive scraper/discovery operations bounded.
create table public.request_rate_limits (
  subject_key text not null check (length(subject_key) between 1 and 200),
  action text not null check (length(action) between 1 and 80),
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0 check (request_count >= 0),
  updated_at timestamptz not null default now(),
  primary key (subject_key, action)
);

alter table public.request_rate_limits enable row level security;

create or replace function public.consume_request_rate_limit(
  p_subject_key text,
  p_action text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Rate-limit configuration must be positive.';
  end if;

  insert into public.request_rate_limits (
    subject_key, action, window_started_at, request_count, updated_at
  ) values (
    p_subject_key, p_action, now(), 1, now()
  )
  on conflict (subject_key, action) do update
  set
    window_started_at = case
      when public.request_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then now()
      else public.request_rate_limits.window_started_at
    end,
    request_count = case
      when public.request_rate_limits.window_started_at <= now() - make_interval(secs => p_window_seconds)
        then 1
      else public.request_rate_limits.request_count + 1
    end,
    updated_at = now()
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke execute on function public.consume_request_rate_limit(text, text, integer, integer)
from public, anon, authenticated;
grant execute on function public.consume_request_rate_limit(text, text, integer, integer)
to service_role;

-- Audit public share-page views without storing raw visitor IP addresses.
create table public.share_access_logs (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.product_shares(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  visitor_hash text not null,
  user_agent text
);

create index share_access_logs_share_viewed_idx
  on public.share_access_logs(share_id, viewed_at desc);

alter table public.share_access_logs enable row level security;

create policy "Owners can read their share access logs"
on public.share_access_logs for select to authenticated
using (
  exists (
    select 1 from public.product_shares
    where product_shares.id = share_access_logs.share_id
      and product_shares.owner_id = (select auth.uid())
  )
);

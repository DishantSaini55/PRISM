create extension if not exists pgcrypto;

create type public.availability_status as enum (
  'UNKNOWN',
  'IN_STOCK',
  'OUT_OF_STOCK',
  'DISCONTINUED'
);

create type public.product_match_status as enum (
  'PENDING',
  'MATCHED',
  'NEEDS_REVIEW',
  'REJECTED'
);

create type public.price_alert_type as enum (
  'PRICE_DROP',
  'TARGET_REACHED',
  'ALL_TIME_LOW',
  'PERCENTAGE_DROP',
  'BACK_IN_STOCK',
  'PRICE_INCREASE'
);

create type public.scraping_job_status as enum (
  'PENDING',
  'RUNNING',
  'SUCCESS',
  'FAILED',
  'RETRYING'
);

create type public.recommendation_type as enum (
  'BUY_NOW',
  'WAIT',
  'MONITOR'
);

create type public.notification_status as enum (
  'PENDING',
  'SENT',
  'FAILED'
);

-- One public profile per Supabase Auth user.
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stores (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  domain text not null unique,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- A canonical PRISM product, independent of any retailer listing.
create table public.products (
  id uuid primary key default gen_random_uuid(),
  canonical_key text not null unique,
  brand text,
  model text,
  name text not null,
  category text,
  description text,
  image_url text,
  normalized_attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A store-specific listing that may later be matched to a canonical product.
create table public.product_sources (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  store_id uuid not null references public.stores(id) on delete restrict,
  url text not null check (url ~* '^https?://'),
  source_name text,
  seller text,
  availability public.availability_status not null default 'UNKNOWN',
  current_price numeric(12, 2) check (current_price is null or current_price >= 0),
  currency char(3) not null default 'INR',
  mrp numeric(12, 2) check (mrp is null or mrp >= 0),
  discount_percentage numeric(5, 2)
    check (discount_percentage is null or discount_percentage between 0 and 100),
  image_url text,
  source_attributes jsonb not null default '{}'::jsonb,
  match_status public.product_match_status not null default 'PENDING',
  match_confidence numeric(5, 2)
    check (match_confidence is null or match_confidence between 0 and 100),
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, url)
);

-- A user can track a canonical product without creating an alert.
create table public.tracked_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, product_id)
);

-- Immutable observations. Never update or overwrite these rows.
create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_source_id uuid not null
    references public.product_sources(id) on delete cascade,
  price numeric(12, 2) not null check (price >= 0),
  currency char(3) not null,
  availability public.availability_status not null default 'UNKNOWN',
  checked_at timestamptz not null default now()
);

create table public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  alert_type public.price_alert_type not null,
  target_price numeric(12, 2) check (target_price is null or target_price >= 0),
  percentage_drop numeric(5, 2)
    check (percentage_drop is null or percentage_drop between 0 and 100),
  is_active boolean not null default true,
  last_triggered_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.scraping_jobs (
  id uuid primary key default gen_random_uuid(),
  product_source_id uuid not null
    references public.product_sources(id) on delete cascade,
  status public.scraping_job_status not null default 'PENDING',
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 3 check (max_attempts > 0),
  started_at timestamptz,
  completed_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.predictions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  predicted_price numeric(12, 2) not null check (predicted_price >= 0),
  prediction_date date not null,
  confidence numeric(5, 2) check (confidence is null or confidence between 0 and 100),
  model_version text not null,
  created_at timestamptz not null default now(),
  unique (product_id, prediction_date, model_version)
);

create table public.recommendations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  buy_score numeric(5, 2) not null check (buy_score between 0 and 100),
  recommendation public.recommendation_type not null,
  confidence numeric(5, 2) check (confidence is null or confidence between 0 and 100),
  reasoning jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  price_alert_id uuid references public.price_alerts(id) on delete set null,
  channel text not null default 'EMAIL',
  status public.notification_status not null default 'PENDING',
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references public.users(id) on delete cascade,
  email_alerts_enabled boolean not null default true,
  browser_push_enabled boolean not null default false,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger product_sources_set_updated_at
before update on public.product_sources
for each row execute function public.set_updated_at();

create trigger user_preferences_set_updated_at
before update on public.user_preferences
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  insert into public.user_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create index product_sources_product_id_idx on public.product_sources(product_id);
create index product_sources_store_id_idx on public.product_sources(store_id);
create index product_sources_match_status_idx on public.product_sources(match_status);
create index tracked_products_user_id_idx on public.tracked_products(user_id);
create index price_history_source_checked_at_idx
  on public.price_history(product_source_id, checked_at desc);
create index price_alerts_user_id_idx on public.price_alerts(user_id);
create index price_alerts_active_idx on public.price_alerts(is_active) where is_active;
create index scraping_jobs_pending_idx
  on public.scraping_jobs(status, created_at)
  where status in ('PENDING', 'RETRYING');
create index predictions_product_date_idx
  on public.predictions(product_id, prediction_date);
create index recommendations_product_created_idx
  on public.recommendations(product_id, created_at desc);
create index notifications_user_status_idx
  on public.notifications(user_id, status);

alter table public.users enable row level security;
alter table public.stores enable row level security;
alter table public.products enable row level security;
alter table public.product_sources enable row level security;
alter table public.tracked_products enable row level security;
alter table public.price_history enable row level security;
alter table public.price_alerts enable row level security;
alter table public.scraping_jobs enable row level security;
alter table public.predictions enable row level security;
alter table public.recommendations enable row level security;
alter table public.notifications enable row level security;
alter table public.user_preferences enable row level security;

create policy "Users can view their own profile"
on public.users for select to authenticated
using ((select auth.uid()) = id);

create policy "Users can update their own profile"
on public.users for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "Authenticated users can read active stores"
on public.stores for select to authenticated
using (is_active = true);

create policy "Authenticated users can read canonical products"
on public.products for select to authenticated
using (true);

create policy "Authenticated users can read product sources"
on public.product_sources for select to authenticated
using (true);

create policy "Authenticated users can read price history"
on public.price_history for select to authenticated
using (true);

create policy "Users can view their tracked products"
on public.tracked_products for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can track products"
on public.tracked_products for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their tracked products"
on public.tracked_products for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can stop tracking their products"
on public.tracked_products for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can view their alerts"
on public.price_alerts for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their alerts"
on public.price_alerts for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their alerts"
on public.price_alerts for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their alerts"
on public.price_alerts for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can view their notifications"
on public.notifications for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can view their preferences"
on public.user_preferences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their preferences"
on public.user_preferences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their preferences"
on public.user_preferences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);
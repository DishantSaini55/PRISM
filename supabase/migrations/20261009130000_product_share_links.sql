create table public.product_shares (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  token text not null unique check (length(token) >= 32),
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (owner_id, product_id)
);

create index product_shares_token_idx on public.product_shares(token)
  where revoked_at is null;

alter table public.product_shares enable row level security;

create policy "Users can view their product share links"
on public.product_shares for select to authenticated
using ((select auth.uid()) = owner_id);

create policy "Users can revoke their product share links"
on public.product_shares for update to authenticated
using ((select auth.uid()) = owner_id)
with check ((select auth.uid()) = owner_id);

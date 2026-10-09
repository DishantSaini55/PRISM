-- Personal annotations belong to the user, never to the shared canonical product.
create table public.product_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  note text not null default '' check (char_length(note) <= 1000),
  tags text[] not null default '{}'::text[] check (cardinality(tags) <= 8),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index product_notes_user_product_idx on public.product_notes(user_id, product_id);

create trigger product_notes_set_updated_at
before update on public.product_notes
for each row execute function public.set_updated_at();

alter table public.product_notes enable row level security;

create policy "Users can read their product notes"
on public.product_notes for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their product notes"
on public.product_notes for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their product notes"
on public.product_notes for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy "Users can delete their product notes"
on public.product_notes for delete to authenticated
using (user_id = (select auth.uid()));

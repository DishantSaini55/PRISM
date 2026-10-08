create or replace function public.record_price_observation(
  p_product_source_id uuid,
  p_price numeric(12, 2),
  p_currency char(3),
  p_availability public.availability_status,
  p_checked_at timestamptz default now()
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_history_id uuid;
begin
  if p_price < 0 then
    raise exception 'Price cannot be negative.';
  end if;

  update public.product_sources
  set
    current_price = p_price,
    currency = p_currency,
    availability = p_availability,
    last_checked_at = p_checked_at
  where id = p_product_source_id;

  if not found then
    raise exception 'Product source % does not exist.', p_product_source_id;
  end if;

  insert into public.price_history (
    product_source_id,
    price,
    currency,
    availability,
    checked_at
  )
  values (
    p_product_source_id,
    p_price,
    p_currency,
    p_availability,
    p_checked_at
  )
  returning id into v_history_id;

  return v_history_id;
end;
$$;

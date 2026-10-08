create or replace function public.enqueue_target_price_notifications(
  p_product_source_id uuid,
  p_price numeric(12, 2),
  p_currency char(3),
  p_availability public.availability_status,
  p_checked_at timestamptz default now()
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_product_id uuid;
  v_notification_count integer;
begin
  if p_price < 0 then
    raise exception 'Price cannot be negative.';
  end if;

  select product_id into v_product_id
  from public.product_sources
  where id = p_product_source_id;

  if v_product_id is null or p_availability = 'OUT_OF_STOCK' then
    return 0;
  end if;

  -- Updating the alert and inserting its notification in one statement makes
  -- target notifications idempotent, even when workers overlap.
  with triggered_alerts as (
    update public.price_alerts
    set last_triggered_at = p_checked_at
    where product_id = v_product_id
      and alert_type = 'TARGET_REACHED'
      and is_active = true
      and target_price is not null
      and p_price <= target_price
      and last_triggered_at is null
    returning id, user_id, target_price
  ), inserted_notifications as (
    insert into public.notifications (
      user_id,
      price_alert_id,
      channel,
      status,
      payload,
      sent_at
    )
    select
      user_id,
      id,
      'IN_APP',
      'SENT',
      jsonb_build_object(
        'product_source_id', p_product_source_id,
        'price', p_price,
        'currency', p_currency,
        'target_price', target_price,
        'checked_at', p_checked_at
      ),
      p_checked_at
    from triggered_alerts
    returning id
  )
  select count(*)::integer into v_notification_count
  from inserted_notifications;

  return v_notification_count;
end;
$$;

revoke execute on function public.enqueue_target_price_notifications(
  uuid,
  numeric,
  char,
  public.availability_status,
  timestamptz
) from public, anon, authenticated;

grant execute on function public.enqueue_target_price_notifications(
  uuid,
  numeric,
  char,
  public.availability_status,
  timestamptz
) to service_role;

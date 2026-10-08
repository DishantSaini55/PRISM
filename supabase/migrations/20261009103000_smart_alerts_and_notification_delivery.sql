-- Smart alerts can be read in the dashboard without treating a delivery state
-- as an unread in-app alert.
alter table public.notifications
  add column if not exists read_at timestamptz;

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, created_at desc)
  where read_at is null and channel = 'IN_APP';

-- Keep existing target-price notifications compatible with the inbox read
-- state. External delivery is intentionally not configured by this migration.
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
  v_notification_count integer := 0;
  v_alert record;
begin
  if p_price < 0 then
    raise exception 'Price cannot be negative.';
  end if;

  select product_id into v_product_id
  from public.product_sources
  where id = p_product_source_id;

  if v_product_id is null or p_availability in ('OUT_OF_STOCK', 'DISCONTINUED') then
    return 0;
  end if;

  for v_alert in
    update public.price_alerts
    set last_triggered_at = p_checked_at
    where product_id = v_product_id
      and alert_type = 'TARGET_REACHED'
      and is_active = true
      and target_price is not null
      and p_price <= target_price
      and last_triggered_at is null
    returning id, user_id, target_price
  loop
    insert into public.notifications (
      user_id, price_alert_id, channel, status, payload, sent_at
    ) values (
      v_alert.user_id,
      v_alert.id,
      'IN_APP',
      'SENT',
      jsonb_build_object(
        'alert_type', 'TARGET_REACHED',
        'product_source_id', p_product_source_id,
        'price', p_price,
        'currency', p_currency,
        'target_price', v_alert.target_price,
        'checked_at', p_checked_at
      ),
      p_checked_at
    );

    v_notification_count := v_notification_count + 1;
  end loop;

  return v_notification_count;
end;
$$;

-- Evaluate percentage-drop and back-in-stock alerts after a new immutable
-- price observation is recorded. The alert row is updated atomically to keep
-- overlapping workers from creating duplicate notifications.
create or replace function public.enqueue_market_change_notifications(
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
  v_previous_price numeric(12, 2);
  v_previous_availability public.availability_status;
  v_drop_percentage numeric(8, 2);
  v_alert record;
  v_should_trigger boolean;
  v_notification_count integer := 0;
begin
  if p_price < 0 then
    raise exception 'Price cannot be negative.';
  end if;

  select product_id into v_product_id
  from public.product_sources
  where id = p_product_source_id;

  if v_product_id is null then
    return 0;
  end if;

  select price, availability
  into v_previous_price, v_previous_availability
  from public.price_history
  where product_source_id = p_product_source_id
    and checked_at < p_checked_at
  order by checked_at desc
  limit 1;

  if v_previous_price is not null and v_previous_price > 0 then
    v_drop_percentage := round(((v_previous_price - p_price) / v_previous_price) * 100, 2);
  end if;

  for v_alert in
    select id, user_id, alert_type, percentage_drop
    from public.price_alerts
    where product_id = v_product_id
      and is_active = true
      and alert_type in ('PRICE_DROP', 'BACK_IN_STOCK')
      and last_triggered_at is null
  loop
    v_should_trigger :=
      (v_alert.alert_type = 'PRICE_DROP'
        and p_availability not in ('OUT_OF_STOCK', 'DISCONTINUED')
        and v_drop_percentage is not null
        and v_drop_percentage >= coalesce(v_alert.percentage_drop, 0))
      or
      (v_alert.alert_type = 'BACK_IN_STOCK'
        and p_availability = 'IN_STOCK'
        and v_previous_availability in ('OUT_OF_STOCK', 'DISCONTINUED'));

    if not v_should_trigger then
      continue;
    end if;

    update public.price_alerts
    set last_triggered_at = p_checked_at
    where id = v_alert.id
      and last_triggered_at is null;

    if not found then
      continue;
    end if;

    insert into public.notifications (
      user_id, price_alert_id, channel, status, payload, sent_at
    ) values (
      v_alert.user_id,
      v_alert.id,
      'IN_APP',
      'SENT',
      jsonb_build_object(
        'alert_type', v_alert.alert_type,
        'product_source_id', p_product_source_id,
        'price', p_price,
        'currency', p_currency,
        'previous_price', v_previous_price,
        'percentage_drop', v_drop_percentage,
        'checked_at', p_checked_at
      ),
      p_checked_at
    );

    v_notification_count := v_notification_count + 1;
  end loop;

  return v_notification_count;
end;
$$;

revoke execute on function public.enqueue_target_price_notifications(
  uuid, numeric, char, public.availability_status, timestamptz
) from public, anon, authenticated;

revoke execute on function public.enqueue_market_change_notifications(
  uuid, numeric, char, public.availability_status, timestamptz
) from public, anon, authenticated;

grant execute on function public.enqueue_target_price_notifications(
  uuid, numeric, char, public.availability_status, timestamptz
) to service_role;

grant execute on function public.enqueue_market_change_notifications(
  uuid, numeric, char, public.availability_status, timestamptz
) to service_role;

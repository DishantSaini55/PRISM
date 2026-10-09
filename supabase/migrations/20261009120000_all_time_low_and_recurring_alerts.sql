-- Smart alerts re-arm after a recovery, and all-time-low alerts fire for each
-- genuinely new low price (never for a repeated unchanged observation).
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
  v_previous_low numeric(12, 2);
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

  select min(price) into v_previous_low
  from public.price_history
  where product_source_id = p_product_source_id
    and checked_at < p_checked_at;

  if v_previous_price is not null and v_previous_price > 0 then
    v_drop_percentage := round(((v_previous_price - p_price) / v_previous_price) * 100, 2);
  end if;

  -- A price increase re-arms a price-drop alert; a later qualifying drop can
  -- then notify again. An out-of-stock transition similarly re-arms stock alerts.
  if v_previous_price is not null and p_price > v_previous_price then
    update public.price_alerts
    set last_triggered_at = null
    where product_id = v_product_id
      and alert_type = 'PRICE_DROP'
      and is_active = true;
  end if;

  if p_availability in ('OUT_OF_STOCK', 'DISCONTINUED') then
    update public.price_alerts
    set last_triggered_at = null
    where product_id = v_product_id
      and alert_type = 'BACK_IN_STOCK'
      and is_active = true;
  end if;

  for v_alert in
    select id, user_id, alert_type, percentage_drop
    from public.price_alerts
    where product_id = v_product_id
      and is_active = true
      and alert_type in ('PRICE_DROP', 'BACK_IN_STOCK', 'ALL_TIME_LOW')
      and (alert_type = 'ALL_TIME_LOW' or last_triggered_at is null)
  loop
    v_should_trigger :=
      (v_alert.alert_type = 'PRICE_DROP'
        and p_availability not in ('OUT_OF_STOCK', 'DISCONTINUED')
        and v_drop_percentage is not null
        and v_drop_percentage >= coalesce(v_alert.percentage_drop, 0))
      or
      (v_alert.alert_type = 'BACK_IN_STOCK'
        and p_availability = 'IN_STOCK'
        and v_previous_availability in ('OUT_OF_STOCK', 'DISCONTINUED'))
      or
      (v_alert.alert_type = 'ALL_TIME_LOW'
        and p_availability not in ('OUT_OF_STOCK', 'DISCONTINUED')
        and v_previous_low is not null
        and p_price < v_previous_low);

    if not v_should_trigger then
      continue;
    end if;

    update public.price_alerts
    set last_triggered_at = p_checked_at
    where id = v_alert.id
      and (v_alert.alert_type = 'ALL_TIME_LOW' or last_triggered_at is null);

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
        'previous_low', v_previous_low,
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

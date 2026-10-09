-- Queue email independently from the in-app inbox. This makes delivery
-- retryable and prevents a provider outage from losing a price alert.

alter table public.notifications
  add column if not exists delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  add column if not exists processing_at timestamptz;

create index if not exists notifications_pending_email_idx
  on public.notifications(created_at)
  where channel = 'EMAIL' and status = 'PENDING';

create or replace function public.create_alert_notifications(
  p_user_id uuid, p_price_alert_id uuid, p_payload jsonb, p_checked_at timestamptz
)
returns void language plpgsql set search_path = public as $$
begin
  insert into public.notifications (user_id, price_alert_id, channel, status, payload, sent_at)
  values (p_user_id, p_price_alert_id, 'IN_APP', 'SENT', p_payload, p_checked_at);

  if coalesce((select email_alerts_enabled from public.user_preferences where user_id = p_user_id), true) then
    insert into public.notifications (user_id, price_alert_id, channel, status, payload)
    values (p_user_id, p_price_alert_id, 'EMAIL', 'PENDING', p_payload);
  end if;
end;
$$;

create or replace function public.enqueue_target_price_notifications(
  p_product_source_id uuid, p_price numeric(12, 2), p_currency char(3),
  p_availability public.availability_status, p_checked_at timestamptz default now()
)
returns integer language plpgsql set search_path = public as $$
declare v_product_id uuid; v_notification_count integer := 0; v_alert record;
begin
  if p_price < 0 then raise exception 'Price cannot be negative.'; end if;
  select product_id into v_product_id from public.product_sources where id = p_product_source_id;
  if v_product_id is null or p_availability in ('OUT_OF_STOCK', 'DISCONTINUED') then return 0; end if;
  for v_alert in
    update public.price_alerts set last_triggered_at = p_checked_at
    where product_id = v_product_id and alert_type = 'TARGET_REACHED' and is_active = true
      and target_price is not null and p_price <= target_price and last_triggered_at is null
    returning id, user_id, target_price
  loop
    perform public.create_alert_notifications(v_alert.user_id, v_alert.id,
      jsonb_build_object('alert_type', 'TARGET_REACHED', 'product_source_id', p_product_source_id,
        'price', p_price, 'currency', p_currency, 'target_price', v_alert.target_price, 'checked_at', p_checked_at),
      p_checked_at);
    v_notification_count := v_notification_count + 1;
  end loop;
  return v_notification_count;
end;
$$;

create or replace function public.enqueue_market_change_notifications(
  p_product_source_id uuid, p_price numeric(12, 2), p_currency char(3),
  p_availability public.availability_status, p_checked_at timestamptz default now()
)
returns integer language plpgsql set search_path = public as $$
declare
  v_product_id uuid; v_previous_price numeric(12, 2); v_previous_low numeric(12, 2);
  v_previous_availability public.availability_status; v_drop_percentage numeric(8, 2);
  v_alert record; v_should_trigger boolean; v_notification_count integer := 0;
begin
  if p_price < 0 then raise exception 'Price cannot be negative.'; end if;
  select product_id into v_product_id from public.product_sources where id = p_product_source_id;
  if v_product_id is null then return 0; end if;
  select price, availability into v_previous_price, v_previous_availability from public.price_history
  where product_source_id = p_product_source_id and checked_at < p_checked_at order by checked_at desc limit 1;
  select min(price) into v_previous_low from public.price_history
  where product_source_id = p_product_source_id and checked_at < p_checked_at;
  if v_previous_price is not null and v_previous_price > 0 then
    v_drop_percentage := round(((v_previous_price - p_price) / v_previous_price) * 100, 2);
  end if;
  if v_previous_price is not null and p_price > v_previous_price then
    update public.price_alerts set last_triggered_at = null
    where product_id = v_product_id and alert_type = 'PRICE_DROP' and is_active = true;
  end if;
  if p_availability in ('OUT_OF_STOCK', 'DISCONTINUED') then
    update public.price_alerts set last_triggered_at = null
    where product_id = v_product_id and alert_type = 'BACK_IN_STOCK' and is_active = true;
  end if;
  for v_alert in
    select id, user_id, alert_type, percentage_drop from public.price_alerts
    where product_id = v_product_id and is_active = true
      and alert_type in ('PRICE_DROP', 'BACK_IN_STOCK', 'ALL_TIME_LOW')
      and (alert_type = 'ALL_TIME_LOW' or last_triggered_at is null)
  loop
    v_should_trigger :=
      (v_alert.alert_type = 'PRICE_DROP' and p_availability not in ('OUT_OF_STOCK', 'DISCONTINUED')
        and v_drop_percentage is not null and v_drop_percentage >= coalesce(v_alert.percentage_drop, 0))
      or (v_alert.alert_type = 'BACK_IN_STOCK' and p_availability = 'IN_STOCK'
        and v_previous_availability in ('OUT_OF_STOCK', 'DISCONTINUED'))
      or (v_alert.alert_type = 'ALL_TIME_LOW' and p_availability not in ('OUT_OF_STOCK', 'DISCONTINUED')
        and v_previous_low is not null and p_price < v_previous_low);
    if not v_should_trigger then continue; end if;
    update public.price_alerts set last_triggered_at = p_checked_at
    where id = v_alert.id and (v_alert.alert_type = 'ALL_TIME_LOW' or last_triggered_at is null);
    if not found then continue; end if;
    perform public.create_alert_notifications(v_alert.user_id, v_alert.id,
      jsonb_build_object('alert_type', v_alert.alert_type, 'product_source_id', p_product_source_id,
        'price', p_price, 'currency', p_currency, 'previous_price', v_previous_price,
        'previous_low', v_previous_low, 'percentage_drop', v_drop_percentage, 'checked_at', p_checked_at),
      p_checked_at);
    v_notification_count := v_notification_count + 1;
  end loop;
  return v_notification_count;
end;
$$;

create or replace function public.claim_email_notifications(p_limit integer default 10)
returns table(notification_id uuid, user_email text, payload jsonb, delivery_attempts integer, claimed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidates as (
    select n.id from public.notifications n join public.users u on u.id = n.user_id
    left join public.user_preferences pref on pref.user_id = n.user_id
    where n.channel = 'EMAIL' and u.email is not null and coalesce(pref.email_alerts_enabled, true)
      and n.delivery_attempts < 3
      and n.status = 'PENDING'
      and (n.processing_at is null or n.processing_at < now() - interval '10 minutes')
    order by n.created_at asc for update of n skip locked limit least(greatest(p_limit, 1), 25)
  ), claimed as (
    update public.notifications n set processing_at = now(), delivery_attempts = n.delivery_attempts + 1
    from candidates c where n.id = c.id returning n.id, n.user_id, n.payload, n.delivery_attempts, n.processing_at
  )
  select c.id, u.email, c.payload, c.delivery_attempts, c.processing_at from claimed c join public.users u on u.id = c.user_id;
end;
$$;

create or replace function public.finish_email_notification(
  p_notification_id uuid, p_claimed_at timestamptz, p_delivered boolean, p_error text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.notifications
  set status = case when p_delivered then 'SENT'::public.notification_status
                    when delivery_attempts >= 3 then 'FAILED'::public.notification_status
                    else 'PENDING'::public.notification_status end,
      sent_at = case when p_delivered then now() else sent_at end,
      processing_at = null,
      error = case when p_delivered then null else left(coalesce(p_error, 'Email delivery failed.'), 1000) end
  where id = p_notification_id and channel = 'EMAIL' and status = 'PENDING' and processing_at = p_claimed_at;
end;
$$;

revoke execute on function public.create_alert_notifications(uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_email_notifications(integer) from public, anon, authenticated;
revoke execute on function public.finish_email_notification(uuid, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.enqueue_target_price_notifications(uuid, numeric, char, public.availability_status, timestamptz) to service_role;
grant execute on function public.enqueue_market_change_notifications(uuid, numeric, char, public.availability_status, timestamptz) to service_role;
grant execute on function public.claim_email_notifications(integer) to service_role;
grant execute on function public.finish_email_notification(uuid, timestamptz, boolean, text) to service_role;

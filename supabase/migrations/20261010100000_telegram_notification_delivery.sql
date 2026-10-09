-- Telegram is opt-in and stores only a chat identifier; the bot token remains
-- a server-side environment secret.
alter table public.user_preferences
  add column if not exists telegram_alerts_enabled boolean not null default false,
  add column if not exists telegram_chat_id text
    check (telegram_chat_id is null or telegram_chat_id ~ '^-?[0-9]{5,20}$');

create index if not exists notifications_pending_telegram_idx
  on public.notifications(created_at)
  where channel = 'TELEGRAM' and status = 'PENDING';

create or replace function public.create_alert_notifications(
  p_user_id uuid, p_price_alert_id uuid, p_payload jsonb, p_checked_at timestamptz
)
returns void language plpgsql set search_path = public as $$
declare v_preferences record;
begin
  select email_alerts_enabled, telegram_alerts_enabled, telegram_chat_id into v_preferences
  from public.user_preferences where user_id = p_user_id;

  insert into public.notifications (user_id, price_alert_id, channel, status, payload, sent_at)
  values (p_user_id, p_price_alert_id, 'IN_APP', 'SENT', p_payload, p_checked_at);

  if coalesce(v_preferences.email_alerts_enabled, true) then
    insert into public.notifications (user_id, price_alert_id, channel, status, payload)
    values (p_user_id, p_price_alert_id, 'EMAIL', 'PENDING', p_payload);
  end if;

  if coalesce(v_preferences.telegram_alerts_enabled, false)
    and nullif(v_preferences.telegram_chat_id, '') is not null then
    insert into public.notifications (user_id, price_alert_id, channel, status, payload)
    values (p_user_id, p_price_alert_id, 'TELEGRAM', 'PENDING', p_payload);
  end if;
end;
$$;

create or replace function public.claim_telegram_notifications(p_limit integer default 10)
returns table(notification_id uuid, chat_id text, payload jsonb, delivery_attempts integer, claimed_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
  with candidates as (
    select n.id
    from public.notifications n
    join public.user_preferences pref on pref.user_id = n.user_id
    where n.channel = 'TELEGRAM' and n.status = 'PENDING'
      and pref.telegram_alerts_enabled and pref.telegram_chat_id is not null
      and n.delivery_attempts < 3
      and (n.processing_at is null or n.processing_at < now() - interval '10 minutes')
    order by n.created_at asc
    for update of n skip locked
    limit least(greatest(p_limit, 1), 25)
  ), claimed as (
    update public.notifications n
    set processing_at = now(), delivery_attempts = n.delivery_attempts + 1
    from candidates c where n.id = c.id
    returning n.id, n.user_id, n.payload, n.delivery_attempts, n.processing_at
  )
  select c.id, pref.telegram_chat_id, c.payload, c.delivery_attempts, c.processing_at
  from claimed c join public.user_preferences pref on pref.user_id = c.user_id;
end;
$$;

create or replace function public.finish_telegram_notification(
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
      error = case when p_delivered then null else left(coalesce(p_error, 'Telegram delivery failed.'), 1000) end
  where id = p_notification_id and channel = 'TELEGRAM' and status = 'PENDING' and processing_at = p_claimed_at;
end;
$$;

revoke execute on function public.create_alert_notifications(uuid, uuid, jsonb, timestamptz) from public, anon, authenticated;
revoke execute on function public.claim_telegram_notifications(integer) from public, anon, authenticated;
revoke execute on function public.finish_telegram_notification(uuid, timestamptz, boolean, text) from public, anon, authenticated;
grant execute on function public.claim_telegram_notifications(integer) to service_role;
grant execute on function public.finish_telegram_notification(uuid, timestamptz, boolean, text) to service_role;

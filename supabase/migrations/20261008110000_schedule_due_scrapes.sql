-- Queue each actively tracked source at most once per interval. This only
-- schedules work; a separate worker claims and processes the jobs.
create or replace function public.schedule_due_scrapes(
  p_minimum_interval_hours integer default 24
)
returns integer
language plpgsql
set search_path = public
as $$
declare
  v_enqueued_count integer;
begin
  if p_minimum_interval_hours < 1 or p_minimum_interval_hours > 168 then
    raise exception 'Scrape interval must be between 1 and 168 hours.';
  end if;

  -- Prevent two cron invocations from scheduling the same source together.
  perform pg_advisory_xact_lock(hashtext('prism.schedule_due_scrapes'));

  with due_sources as (
    select distinct product_sources.id
    from public.product_sources
    join public.tracked_products
      on tracked_products.product_id = product_sources.product_id
    where tracked_products.is_active = true
      and (
        product_sources.last_checked_at is null
        or product_sources.last_checked_at <= now()
          - make_interval(hours => p_minimum_interval_hours)
      )
      and not exists (
        select 1
        from public.scraping_jobs
        where scraping_jobs.product_source_id = product_sources.id
          and scraping_jobs.status in ('PENDING', 'RUNNING', 'RETRYING')
      )
  ), inserted_jobs as (
    insert into public.scraping_jobs (product_source_id, status, available_at)
    select id, 'PENDING', now()
    from due_sources
    returning id
  )
  select count(*)::integer into v_enqueued_count
  from inserted_jobs;

  return v_enqueued_count;
end;
$$;

revoke execute on function public.schedule_due_scrapes(integer)
from public, anon, authenticated;

grant execute on function public.schedule_due_scrapes(integer)
to service_role;

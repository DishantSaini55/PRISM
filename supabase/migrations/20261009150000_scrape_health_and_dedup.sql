-- Manual retry requests reuse an existing queued/running job instead of
-- creating duplicates for the same store source.
create or replace function public.enqueue_scraping_job(
  p_product_source_id uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_job_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('prism.enqueue.' || p_product_source_id::text));

  select id into v_job_id
  from public.scraping_jobs
  where product_source_id = p_product_source_id
    and status in ('PENDING', 'RUNNING', 'RETRYING')
  order by created_at desc
  limit 1;

  if v_job_id is not null then
    return v_job_id;
  end if;

  insert into public.scraping_jobs (product_source_id, status, available_at)
  values (p_product_source_id, 'PENDING', now())
  returning id into v_job_id;

  return v_job_id;
end;
$$;

revoke execute on function public.enqueue_scraping_job(uuid)
from public, anon, authenticated;
grant execute on function public.enqueue_scraping_job(uuid)
to service_role;

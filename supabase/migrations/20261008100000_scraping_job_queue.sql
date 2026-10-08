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
  insert into public.scraping_jobs (product_source_id, status)
  values (p_product_source_id, 'PENDING')
  returning id into v_job_id;

  return v_job_id;
end;
$$;

create or replace function public.claim_scraping_jobs(
  p_limit integer default 5
)
returns table (
  job_id uuid,
  product_source_id uuid,
  attempt integer,
  max_attempts integer,
  created_at timestamptz
)
language plpgsql
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 100 then
    raise exception 'Job claim limit must be between 1 and 100.';
  end if;

  return query
  with claimable_jobs as (
    select id
    from public.scraping_jobs
    where status in ('PENDING', 'RETRYING')
    order by created_at asc
    for update skip locked
    limit p_limit
  )
  update public.scraping_jobs as jobs
  set
    status = 'RUNNING',
    attempt = jobs.attempt + 1,
    started_at = now(),
    completed_at = null,
    error = null
  from claimable_jobs
  where jobs.id = claimable_jobs.id
  returning jobs.id, jobs.product_source_id, jobs.attempt, jobs.max_attempts, jobs.created_at;
end;
$$;

create or replace function public.complete_scraping_job(
  p_job_id uuid,
  p_status public.scraping_job_status,
  p_error text default null
)
returns void
language plpgsql
set search_path = public
as $$
begin
  if p_status not in ('SUCCESS', 'FAILED') then
    raise exception 'Completed jobs must have SUCCESS or FAILED status.';
  end if;

  update public.scraping_jobs
  set
    status = p_status,
    completed_at = now(),
    error = p_error
  where id = p_job_id
    and status = 'RUNNING';

  if not found then
    raise exception 'Running scraping job % was not found.', p_job_id;
  end if;
end;
$$;

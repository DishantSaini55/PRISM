alter table public.scraping_jobs
add column available_at timestamptz not null default now();

create index scraping_jobs_available_idx
on public.scraping_jobs(status, available_at, created_at)
where status in ('PENDING', 'RETRYING');

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
      and available_at <= now()
    order by available_at asc, created_at asc
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

create or replace function public.fail_scraping_job(
  p_job_id uuid,
  p_error text
)
returns public.scraping_job_status
language plpgsql
set search_path = public
as $$
declare
  v_attempt integer;
  v_max_attempts integer;
  v_status public.scraping_job_status;
  v_backoff_seconds integer;
begin
  select attempt, max_attempts
  into v_attempt, v_max_attempts
  from public.scraping_jobs
  where id = p_job_id
    and status = 'RUNNING'
  for update;

  if not found then
    raise exception 'Running scraping job % was not found.', p_job_id;
  end if;

  if v_attempt >= v_max_attempts then
    v_status := 'FAILED';

    update public.scraping_jobs
    set
      status = v_status,
      completed_at = now(),
      error = p_error
    where id = p_job_id;
  else
    v_status := 'RETRYING';
    v_backoff_seconds := least(3600, 30 * power(2, v_attempt - 1)::integer);

    update public.scraping_jobs
    set
      status = v_status,
      available_at = now() + make_interval(secs => v_backoff_seconds),
      error = p_error
    where id = p_job_id;
  end if;

  return v_status;
end;
$$;

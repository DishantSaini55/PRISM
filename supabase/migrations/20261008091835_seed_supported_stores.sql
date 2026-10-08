insert into public.stores (name, slug, domain, is_active)
values
  ('Amazon India', 'amazon-in', 'amazon.in', true),
  ('Flipkart', 'flipkart', 'flipkart.com', true),
  ('Croma', 'croma', 'croma.com', true),
  ('Reliance Digital', 'reliance-digital', 'reliancedigital.in', true)
on conflict (slug) do update
set
  name = excluded.name,
  domain = excluded.domain,
  is_active = excluded.is_active;
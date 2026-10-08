create policy "Users can view recommendations for tracked products"
on public.recommendations for select to authenticated
using (
  exists (
    select 1
    from public.tracked_products
    where tracked_products.product_id = recommendations.product_id
      and tracked_products.user_id = (select auth.uid())
  )
);

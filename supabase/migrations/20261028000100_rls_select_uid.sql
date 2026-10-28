-- Evaluate auth.uid() once per query instead of once per row (Supabase
-- advisor 0003_auth_rls_initplan).
alter policy "owner reads own row" on public.app_data
  using ((select auth.uid()) = user_id);
alter policy "owner writes own row" on public.app_data
  with check ((select auth.uid()) = user_id);
alter policy "owner updates own row" on public.app_data
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

alter table public.venues add column if not exists category text not null default 'other';

drop policy if exists "users delete their venue suggestions" on public.venues;
create policy "users delete their venue suggestions" on public.venues
  for delete to authenticated using (suggested_by = auth.uid());

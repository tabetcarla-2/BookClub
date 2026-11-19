alter table public.venues
  add column if not exists categories text[] not null default '{}',
  add column if not exists keywords text[] not null default '{}';

update public.venues
set categories = array[category]
where cardinality(categories) = 0 and category is not null;

create policy "users update their venue suggestions" on public.venues
  for update to authenticated using (suggested_by = auth.uid())
  with check (suggested_by = auth.uid());

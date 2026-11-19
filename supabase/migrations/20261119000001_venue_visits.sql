create table if not exists public.venue_visits (
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

alter table public.venue_visits enable row level security;

create policy "members read venue visits" on public.venue_visits
  for select to authenticated
  using (exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id)));

create policy "members mark venues tried" on public.venue_visits
  for insert to authenticated
  with check (user_id = auth.uid() and exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id)));

create policy "users remove their venue visit" on public.venue_visits
  for delete to authenticated
  using (user_id = auth.uid());

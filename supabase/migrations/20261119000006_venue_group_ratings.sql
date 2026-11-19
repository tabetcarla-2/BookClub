create table if not exists public.venue_group_visits (
  venue_id uuid primary key references public.venues(id) on delete cascade,
  marked_by uuid not null references public.profiles(id) on delete cascade,
  tried_at timestamptz not null default now()
);

create table if not exists public.venue_ratings (
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating numeric(2, 1) not null check (rating between 0.5 and 5 and mod(rating * 2, 1) = 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

alter table public.venue_group_visits enable row level security;
alter table public.venue_ratings enable row level security;

create policy "authenticated users read group venue visits" on public.venue_group_visits for select to authenticated using (true);
create policy "authenticated users mark group venue visits" on public.venue_group_visits for insert to authenticated with check (marked_by = auth.uid());
create policy "users remove their group venue visit" on public.venue_group_visits for delete to authenticated using (marked_by = auth.uid());

create policy "authenticated users read venue ratings" on public.venue_ratings for select to authenticated using (true);
create policy "users rate tried venues" on public.venue_ratings for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.venue_group_visits v where v.venue_id = venue_id));
create policy "users update venue ratings" on public.venue_ratings for update to authenticated using (user_id = auth.uid() and exists (select 1 from public.venue_group_visits v where v.venue_id = venue_id)) with check (user_id = auth.uid());
create policy "users remove venue ratings" on public.venue_ratings for delete to authenticated using (user_id = auth.uid());

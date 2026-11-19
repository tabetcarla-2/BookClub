alter table public.venues add column if not exists latitude double precision;
alter table public.venues add column if not exists longitude double precision;

create table if not exists public.venue_votes (
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (venue_id, user_id)
);

create table if not exists public.venue_comments (
  id uuid primary key default gen_random_uuid(),
  venue_id uuid not null references public.venues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.venue_votes enable row level security;
alter table public.venue_comments enable row level security;

create policy "members read venue votes" on public.venue_votes for select to authenticated using (exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id)));
create policy "users manage their venue vote" on public.venue_votes for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id)));
create policy "users update their venue vote" on public.venue_votes for update to authenticated using (user_id = auth.uid() and exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id))) with check (user_id = auth.uid());
create policy "users remove their venue vote" on public.venue_votes for delete to authenticated using (user_id = auth.uid() and exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id)));

create policy "members read venue comments" on public.venue_comments for select to authenticated using (exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id)));
create policy "users add venue comments" on public.venue_comments for insert to authenticated with check (user_id = auth.uid() and exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id)));
create policy "users remove their venue comments" on public.venue_comments for delete to authenticated using (user_id = auth.uid() and exists (select 1 from public.venues v where v.id = venue_id and public.is_club_member(v.club_id)));

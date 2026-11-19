create table if not exists public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

alter table public.event_rsvps enable row level security;

drop policy if exists "members read events" on public.events;
create policy "authenticated users read events" on public.events for select to authenticated using (true);

drop policy if exists "members read event RSVPs" on public.event_rsvps;
create policy "authenticated users read event RSVPs" on public.event_rsvps for select to authenticated using (true);
drop policy if exists "users manage event RSVPs" on public.event_rsvps;
create policy "users manage event RSVPs" on public.event_rsvps for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

do $$
declare
  owner_id uuid;
  club_id uuid;
begin
  select id into owner_id from public.profiles order by created_at limit 1;
  select id into club_id from public.clubs order by created_at limit 1;
  if owner_id is not null and club_id is not null and not exists (select 1 from public.events where title = 'November book discussion') then
    insert into public.events (club_id, title, starts_at, created_by)
    values (club_id, 'November book discussion', '2026-11-21 19:00:00-05', owner_id);
  end if;
end $$;

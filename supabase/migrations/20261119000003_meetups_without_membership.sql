-- Meetups are shared by authenticated readers and do not require club_members.
alter table public.venues alter column club_id drop not null;

drop policy if exists "members read venues" on public.venues;
drop policy if exists "members suggest venues" on public.venues;
create policy "authenticated users read venues" on public.venues for select to authenticated using (true);
create policy "authenticated users suggest venues" on public.venues for insert to authenticated with check (suggested_by = auth.uid());

drop policy if exists "members read venue visits" on public.venue_visits;
drop policy if exists "members mark venues tried" on public.venue_visits;
create policy "authenticated users read venue visits" on public.venue_visits for select to authenticated using (true);
create policy "authenticated users mark venues tried" on public.venue_visits for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "members read venue votes" on public.venue_votes;
drop policy if exists "users manage their venue vote" on public.venue_votes;
drop policy if exists "users update their venue vote" on public.venue_votes;
drop policy if exists "users remove their venue vote" on public.venue_votes;
create policy "authenticated users read venue votes" on public.venue_votes for select to authenticated using (true);
create policy "authenticated users add venue votes" on public.venue_votes for insert to authenticated with check (user_id = auth.uid());
create policy "users update their venue vote" on public.venue_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users remove their venue vote" on public.venue_votes for delete to authenticated using (user_id = auth.uid());

drop policy if exists "members read venue comments" on public.venue_comments;
drop policy if exists "users add venue comments" on public.venue_comments;
drop policy if exists "users remove their venue comments" on public.venue_comments;
create policy "authenticated users read venue comments" on public.venue_comments for select to authenticated using (true);
create policy "authenticated users add venue comments" on public.venue_comments for insert to authenticated with check (user_id = auth.uid());
create policy "users remove their venue comments" on public.venue_comments for delete to authenticated using (user_id = auth.uid());

update public.profiles as profile
set full_name = 'Carla'
from auth.users as account
where profile.id = account.id
  and (lower(profile.full_name) = 'tabet.carla' or lower(account.email) like 'tabet.carla@%');

drop policy if exists "members read club books" on public.club_books;
create policy "authenticated users read club books" on public.club_books
  for select to authenticated using (true);

drop policy if exists "users manage progress" on public.reading_progress;
create policy "authenticated users read progress" on public.reading_progress
  for select to authenticated using (true);
create policy "users add their progress" on public.reading_progress
  for insert to authenticated with check (user_id = auth.uid());
create policy "users update their progress" on public.reading_progress
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users delete their progress" on public.reading_progress
  for delete to authenticated using (user_id = auth.uid());

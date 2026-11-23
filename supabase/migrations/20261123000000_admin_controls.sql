create table if not exists public.badges (
  key text primary key,
  title text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.profile_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_key text not null references public.badges(key) on delete cascade,
  awarded_at timestamptz not null default now(),
  primary key (user_id, badge_key)
);

alter table public.badges enable row level security;
alter table public.profile_badges enable row level security;

create or replace function public.is_book_club_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'tabet.carla@gmail.com';
$$;

create policy "members read badge definitions" on public.badges
  for select to authenticated using (true);
create policy "members read profile badges" on public.profile_badges
  for select to authenticated using (true);
create policy "admin manage badge definitions" on public.badges
  for all to authenticated using (public.is_book_club_admin()) with check (public.is_book_club_admin());
create policy "admin manage profile badges" on public.profile_badges
  for all to authenticated using (public.is_book_club_admin()) with check (public.is_book_club_admin());

insert into public.badges (key, title, description)
values
  ('parable-of-the-sower', 'Parable of the Sower', 'Finish Parable of the Sower with the club.'),
  ('husbands-secret', 'A Husband''s Secret', 'Finish A Husband''s Secret with the club.'),
  ('club-meeting', 'Book club meeting', 'Attend a book club meeting.')
on conflict (key) do update set title = excluded.title, description = excluded.description;

create or replace function public.admin_set_current_book(
  target_book_id uuid,
  target_starts_on date default current_date,
  target_ends_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_club_id uuid;
  target_club_book_id uuid;
begin
  if not public.is_book_club_admin() then raise exception 'Only the book club admin can change the current book'; end if;
  select id into target_club_id from public.clubs order by created_at asc limit 1;
  if target_club_id is null then raise exception 'No club exists yet'; end if;
  if not exists (select 1 from public.books where id = target_book_id) then raise exception 'Book does not exist'; end if;

  update public.club_books
  set is_current = false,
      ends_on = coalesce(ends_on, target_starts_on - 1)
  where club_id = target_club_id and is_current;

  select id into target_club_book_id
  from public.club_books
  where club_id = target_club_id and book_id = target_book_id
  order by created_at desc limit 1;

  if target_club_book_id is null then
    insert into public.club_books (club_id, book_id, starts_on, ends_on, is_current)
    values (target_club_id, target_book_id, target_starts_on, target_ends_on, true)
    returning id into target_club_book_id;
  else
    update public.club_books
    set starts_on = target_starts_on, ends_on = target_ends_on, is_current = true
    where id = target_club_book_id;
  end if;
  return target_club_book_id;
end;
$$;

create or replace function public.admin_finish_current_book(target_ends_on date default current_date)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare changed_count integer;
begin
  if not public.is_book_club_admin() then raise exception 'Only the book club admin can finish the current book'; end if;
  update public.club_books
  set is_current = false, ends_on = coalesce(target_ends_on, current_date)
  where is_current;
  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

create or replace function public.admin_assign_badge(target_user_id uuid, target_badge_key text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_book_club_admin() then raise exception 'Only the book club admin can assign badges'; end if;
  insert into public.profile_badges (user_id, badge_key)
  values (target_user_id, target_badge_key)
  on conflict (user_id, badge_key) do nothing;
end;
$$;

create or replace function public.admin_remove_badge(target_user_id uuid, target_badge_key text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_book_club_admin() then raise exception 'Only the book club admin can remove badges'; end if;
  delete from public.profile_badges where user_id = target_user_id and badge_key = target_badge_key;
end;
$$;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_book_club_admin() then raise exception 'Only the book club admin can delete users'; end if;
  if target_user_id = auth.uid() then raise exception 'The admin account cannot be deleted'; end if;
  delete from auth.users where id = target_user_id;
end;
$$;

revoke all on function public.admin_set_current_book(uuid, date, date) from public;
revoke all on function public.admin_finish_current_book(date) from public;
revoke all on function public.admin_assign_badge(uuid, text) from public;
revoke all on function public.admin_remove_badge(uuid, text) from public;
revoke all on function public.admin_delete_user(uuid) from public;
grant execute on function public.admin_set_current_book(uuid, date, date) to authenticated;
grant execute on function public.admin_finish_current_book(date) to authenticated;
grant execute on function public.admin_assign_badge(uuid, text) to authenticated;
grant execute on function public.admin_remove_badge(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;

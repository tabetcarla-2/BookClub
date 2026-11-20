do $$
declare
  target_carla_id uuid;
  target_parable_id uuid;
  target_club_id uuid;
begin
  -- Use the newest Carla profile so this also repairs an account that was recreated.
  select id into target_carla_id
  from public.profiles
  where lower(full_name) = 'carla'
     or lower(username) like 'carla%@%'
     or lower(username) = 'carla'
  order by created_at desc
  limit 1;

  select id into target_parable_id
  from public.books
  where lower(title) = 'parable of the sower'
  limit 1;

  if target_carla_id is null or target_parable_id is null then
    return;
  end if;

  select id into target_club_id
  from public.clubs
  order by created_at
  limit 1;

  if target_club_id is not null and not exists (
    select 1 from public.club_books as cb
    where cb.club_id = target_club_id and cb.book_id = target_parable_id
  ) then
    insert into public.club_books (club_id, book_id, starts_on, ends_on, is_current)
    values (target_club_id, target_parable_id, null, current_date, false);
  end if;

  insert into public.book_reads (book_id, user_id)
  values (target_parable_id, target_carla_id)
  on conflict (book_id, user_id) do nothing;

  insert into public.reading_progress (user_id, book_id, progress, status, updated_at)
  values (target_carla_id, target_parable_id, 100, 'completed', now())
  on conflict (user_id, book_id) do update
    set progress = 100, status = 'completed', updated_at = now();

  insert into public.reviews (user_id, book_id, rating, comment, updated_at)
  values (target_carla_id, target_parable_id, 4, null, now())
  on conflict (user_id, book_id) do update
    set rating = 4, updated_at = now();
end $$;

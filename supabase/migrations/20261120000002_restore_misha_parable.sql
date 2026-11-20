do $$
declare
  misha_id uuid;
  parable_id uuid;
begin
  select id into misha_id
  from public.profiles
  where lower(full_name) = 'misha'
     or lower(username) like 'misha%@%'
     or lower(username) = 'misha'
  order by created_at desc
  limit 1;

  select id into parable_id
  from public.books
  where lower(title) = 'parable of the sower'
  limit 1;

  if misha_id is null or parable_id is null then
    return;
  end if;

  insert into public.book_reads (book_id, user_id)
  values (parable_id, misha_id)
  on conflict (book_id, user_id) do nothing;

  insert into public.reading_progress (user_id, book_id, progress, status, updated_at)
  values (misha_id, parable_id, 100, 'completed', now())
  on conflict (user_id, book_id) do update
    set progress = 100, status = 'completed', updated_at = now();

  insert into public.reviews (user_id, book_id, rating, comment, updated_at)
  values (misha_id, parable_id, 4, null, now())
  on conflict (user_id, book_id) do update
    set rating = 4, updated_at = now();
end $$;

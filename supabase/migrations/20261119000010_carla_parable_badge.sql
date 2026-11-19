do $$
declare
  carla_id uuid;
  parable_id uuid;
begin
  select id into carla_id
  from public.profiles
  where lower(full_name) like '%carla%'
     or lower(username) = 'carla'
  order by created_at
  limit 1;

  if carla_id is null then
    return;
  end if;

  select id into parable_id
  from public.books
  where lower(title) = 'parable of the sower'
  limit 1;

  if parable_id is null then
    insert into public.books (title, author, description)
    values ('Parable of the Sower', 'Octavia E. Butler', 'A groundbreaking speculative novel about survival, community, and rebuilding a future.')
    returning id into parable_id;
  end if;

  insert into public.book_reads (book_id, user_id)
  values (parable_id, carla_id)
  on conflict (book_id, user_id) do nothing;

  insert into public.reading_progress (user_id, book_id, progress, status, updated_at)
  values (carla_id, parable_id, 100, 'completed', now())
  on conflict (user_id, book_id) do update
    set progress = 100, status = 'completed', updated_at = now();
end $$;

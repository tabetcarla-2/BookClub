do $$
declare
  carla_id uuid;
  parable_id uuid;
begin
  select id into carla_id
  from public.profiles
  where lower(full_name) = 'carla'
     or lower(username) = 'carla'
  order by created_at
  limit 1;

  select id into parable_id
  from public.books
  where lower(title) = 'parable of the sower'
  limit 1;

  if carla_id is not null and parable_id is not null then
    insert into public.reviews (user_id, book_id, rating, comment, updated_at)
    values (carla_id, parable_id, 4, null, now())
    on conflict (user_id, book_id) do update
      set rating = 4, updated_at = now();
  end if;
end $$;

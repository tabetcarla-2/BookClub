do $$
declare
  owner_id uuid;
  club_id uuid;
  book_id uuid;
begin
  select id into owner_id from public.profiles order by created_at limit 1;
  if owner_id is null then
    return;
  end if;

  select id into club_id from public.clubs order by created_at limit 1;
  if club_id is null then
    insert into public.clubs (name, created_by)
    values ('The Reading Room', owner_id)
    returning id into club_id;
  end if;

  select id into book_id
  from public.books
  where lower(title) = 'a husband''s secret'
  limit 1;

  if book_id is null then
    insert into public.books (title, author, description)
    values ('A Husband''s Secret', 'Liane Moriarty', 'A page-turning story about secrets, marriage, and the things we keep from the people closest to us.')
    returning id into book_id;
  end if;

  if not exists (select 1 from public.club_books where is_current) then
    insert into public.club_books (club_id, book_id, starts_on, is_current)
    values (club_id, book_id, current_date, true);
  end if;
end $$;

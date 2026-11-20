delete from public.club_books
where book_id in (
  select id
  from public.books
  where lower(title) = 'we were liars'
);

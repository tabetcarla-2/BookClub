-- Personal backlog reads live in book_reads and are intentionally preserved.
-- Only remove the accidental club-history entry.
delete from public.club_books
where book_id in (
  select id
  from public.books
  where lower(title) = 'we were liars'
);

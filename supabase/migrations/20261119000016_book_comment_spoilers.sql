alter table public.book_comments
  add column if not exists spoiler_threshold integer not null default 0;

alter table public.book_comments
  drop constraint if exists book_comments_spoiler_threshold_check;

alter table public.book_comments
  add constraint book_comments_spoiler_threshold_check
  check (spoiler_threshold between 0 and 100);

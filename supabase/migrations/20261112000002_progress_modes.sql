alter table public.reading_progress
  add column if not exists progress_mode text not null default 'percent' check (progress_mode in ('percent', 'pages', 'chapters')),
  add column if not exists current_pages integer check (current_pages is null or current_pages >= 0),
  add column if not exists total_pages integer check (total_pages is null or total_pages > 0),
  add column if not exists current_chapter integer check (current_chapter is null or current_chapter >= 0),
  add column if not exists total_chapters integer check (total_chapters is null or total_chapters > 0);

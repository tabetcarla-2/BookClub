-- Book metadata is shared club data. Any authenticated member may add a
-- catalog entry; backlog ownership is still enforced by backlog_items RLS.
alter table public.books enable row level security;

drop policy if exists "authenticated users add books" on public.books;
create policy "authenticated users add books"
  on public.books
  for insert
  to authenticated
  with check (true);

create table if not exists public.book_votes (
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create table if not exists public.book_reads (
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (book_id, user_id)
);

create table if not exists public.book_comments (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(trim(content)) between 1 and 500),
  created_at timestamptz not null default now()
);

alter table public.book_votes enable row level security;
alter table public.book_reads enable row level security;
alter table public.book_comments enable row level security;

create policy "members read book votes" on public.book_votes for select to authenticated using (true);
create policy "users manage their book vote" on public.book_votes for insert to authenticated with check (user_id = auth.uid());
create policy "users update their book vote" on public.book_votes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users remove their book vote" on public.book_votes for delete to authenticated using (user_id = auth.uid());

create policy "members read book flags" on public.book_reads for select to authenticated using (true);
create policy "users flag books as read" on public.book_reads for insert to authenticated with check (user_id = auth.uid());
create policy "users remove their read flag" on public.book_reads for delete to authenticated using (user_id = auth.uid());

create policy "members read book comments" on public.book_comments for select to authenticated using (true);
create policy "users add book comments" on public.book_comments for insert to authenticated with check (user_id = auth.uid());
create policy "users remove their book comments" on public.book_comments for delete to authenticated using (user_id = auth.uid());

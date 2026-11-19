create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  rating numeric(3, 2) not null check (rating between 0.25 and 5 and mod(rating * 4, 1) = 0),
  comment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

alter table public.reviews enable row level security;

drop policy if exists "members read reviews" on public.reviews;
create policy "members read reviews" on public.reviews for select to authenticated using (true);

drop policy if exists "users manage reviews" on public.reviews;
create policy "users manage reviews" on public.reviews for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

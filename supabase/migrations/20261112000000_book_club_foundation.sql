create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique,
  full_name text not null default '',
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

create table if not exists public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.club_members (
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('member', 'admin')),
  joined_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  cover_url text,
  description text,
  isbn text,
  created_at timestamptz not null default now()
);

create table if not exists public.club_books (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  starts_on date,
  ends_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists one_current_book_per_club on public.club_books (club_id) where is_current;

create table if not exists public.backlog_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  visibility text not null default 'club' check (visibility in ('personal', 'club')),
  created_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.backlog_votes (
  backlog_item_id uuid not null references public.backlog_items(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (backlog_item_id, user_id)
);

create table if not exists public.reading_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  book_id uuid not null references public.books(id) on delete cascade,
  progress integer not null default 0 check (progress between 0 and 100),
  status text not null default 'want_to_read' check (status in ('want_to_read', 'reading', 'paused', 'skipping', 'completed')),
  updated_at timestamptz not null default now(),
  unique (user_id, book_id)
);

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  name text not null,
  address text,
  notes text,
  suggested_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  venue_id uuid references public.venues(id) on delete set null,
  notes text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'username', ''), split_part(coalesce(new.email, 'reader'), '@', 1) || '_' || substr(new.id::text, 1, 6)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

do $$ declare table_name text; begin
  foreach table_name in array array['profiles','clubs','club_members','books','club_books','backlog_items','backlog_votes','reading_progress','venues','events'] loop
    execute format('alter table public.%I enable row level security', table_name);
  end loop;
end $$;

create or replace function public.is_club_member(target_club uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.club_members where club_id = target_club and user_id = auth.uid());
$$;

create policy "profiles are readable by authenticated users" on public.profiles for select to authenticated using (true);
create policy "users manage their profile" on public.profiles for all to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "members read clubs" on public.clubs for select to authenticated using (public.is_club_member(id) or created_by = auth.uid());
create policy "members read membership" on public.club_members for select to authenticated using (user_id = auth.uid() or public.is_club_member(club_id));
create policy "members read books" on public.books for select to authenticated using (true);
create policy "members read club books" on public.club_books for select to authenticated using (public.is_club_member(club_id));
create policy "members read backlog" on public.backlog_items for select to authenticated using (visibility = 'club' or user_id = auth.uid());
create policy "users add backlog" on public.backlog_items for insert to authenticated with check (user_id = auth.uid());
create policy "users manage backlog" on public.backlog_items for delete to authenticated using (user_id = auth.uid());
create policy "members read votes" on public.backlog_votes for select to authenticated using (user_id = auth.uid() or exists (select 1 from public.backlog_items b where b.id = backlog_item_id and b.visibility = 'club'));
create policy "users manage votes" on public.backlog_votes for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "users manage progress" on public.reading_progress for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "members read venues" on public.venues for select to authenticated using (public.is_club_member(club_id));
create policy "members suggest venues" on public.venues for insert to authenticated with check (suggested_by = auth.uid() and public.is_club_member(club_id));
create policy "members read events" on public.events for select to authenticated using (public.is_club_member(club_id));
create policy "members create events" on public.events for insert to authenticated with check (created_by = auth.uid() and public.is_club_member(club_id));

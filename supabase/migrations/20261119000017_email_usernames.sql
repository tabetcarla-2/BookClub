-- Email is the canonical username for this private club.
update public.profiles as profiles
set username = users.email
from auth.users as users
where profiles.id = users.id
  and users.email is not null;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    coalesce(new.email, 'reader_' || substr(replace(new.id::text, '-', ''), 1, 10)),
    coalesce(new.raw_user_meta_data->>'full_name', '')
  ) on conflict (id) do nothing;
  return new;
end;
$$;

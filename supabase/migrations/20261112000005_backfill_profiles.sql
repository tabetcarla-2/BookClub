-- Older accounts may predate the profile trigger. Create the missing profile
-- rows before backlog_items attempts to reference them.
insert into public.profiles (id, username, full_name)
select
  u.id,
  'reader_' || substr(replace(u.id::text, '-', ''), 1, 10),
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(coalesce(u.email, 'reader'), '@', 1))
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict (id) do nothing;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, full_name)
  values (
    new.id,
    'reader_' || substr(replace(new.id::text, '-', ''), 1, 10),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'reader'), '@', 1))
  ) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

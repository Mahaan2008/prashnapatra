-- Teacher approval (server-enforced) + questions the admin assigns to teachers.
-- Applied to project "prashnapatra" as migration teachers_v1.
--
-- * teacher_profiles: one row per teacher email (the admin can add an email before the teacher signs up).
-- * A new sign-up gets a profile automatically (approved = false) from the name / subjects / standards
--   chosen on the sign-up screen.
-- * Only the admin (confirmed account mahaanthakkar2008@gmail.com) can list, approve, change or remove teachers.
-- * Sync refuses accounts that are not approved, so approval cannot be skipped from the browser.
-- * sync_pull_me also delivers the admin's questions assigned to this teacher (or to "all"); a question
--   later un-assigned arrives as a deletion.

create table if not exists public.teacher_profiles (
  email text primary key check (email = lower(email) and position('@' in email) > 1),
  user_id uuid unique references auth.users(id) on delete set null,
  name text,
  subjects jsonb not null default '["physics"]'::jsonb,
  standards jsonb not null default '[11]'::jsonb,
  approved boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.teacher_profiles enable row level security;
revoke all on public.teacher_profiles from anon, authenticated;

create or replace function private.admin_email() returns text
language sql immutable set search_path to '' as $$ select 'mahaanthakkar2008@gmail.com'::text $$;

-- The caller is the admin only with a confirmed account on the admin email.
create or replace function private.is_admin() returns boolean
language sql stable security definer set search_path to '' as $$
  select exists (select 1 from auth.users u
                  where u.id = auth.uid() and lower(u.email) = private.admin_email() and u.email_confirmed_at is not null)
$$;

-- Keep only known subjects / standards.
create or replace function private.clean_subjects(p jsonb) returns jsonb
language sql immutable set search_path to '' as $$
  select coalesce((select jsonb_agg(distinct v) from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) v
                    where v in ('physics', 'maths', 'science')), '["physics"]'::jsonb)
$$;
create or replace function private.clean_standards(p jsonb) returns jsonb
language sql immutable set search_path to '' as $$
  select coalesce((select jsonb_agg(distinct v::int order by v::int) from jsonb_array_elements_text(case when jsonb_typeof(p) = 'array' then p else '[]'::jsonb end) v
                    where v in ('8', '9', '10', '11', '12')), '[11]'::jsonb)
$$;

-- New sign-up → profile (keeps an admin-added profile, including its approval).
create or replace function private.on_auth_user_created() returns trigger
language plpgsql security definer set search_path to '' as $$
begin
  insert into public.teacher_profiles (email, user_id, name, subjects, standards, approved)
  values (lower(new.email), new.id,
          nullif(left(trim(new.raw_user_meta_data ->> 'name'), 120), ''),
          private.clean_subjects(new.raw_user_meta_data -> 'subjects'),
          private.clean_standards(new.raw_user_meta_data -> 'standards'),
          lower(new.email) = private.admin_email())
  on conflict (email) do update
    set user_id = excluded.user_id,
        name = coalesce(public.teacher_profiles.name, excluded.name),
        updated_at = now();
  return new;
end $$;
drop trigger if exists prashnapatra_on_auth_user_created on auth.users;
create trigger prashnapatra_on_auth_user_created after insert on auth.users
  for each row execute function private.on_auth_user_created();

-- Existing accounts: give each a profile. Accounts that already logged in under the old (browser-only)
-- approval keep their access; the admin can revoke it in Settings.
insert into public.teacher_profiles (email, user_id, name, subjects, standards, approved)
select lower(u.email), u.id,
       nullif(left(trim(u.raw_user_meta_data ->> 'name'), 120), ''),
       private.clean_subjects(u.raw_user_meta_data -> 'subjects'),
       private.clean_standards(u.raw_user_meta_data -> 'standards'),
       lower(u.email) = private.admin_email() or (u.email_confirmed_at is not null and u.last_sign_in_at is not null)
from auth.users u
where u.email is not null
on conflict (email) do nothing;

/* ---------- for every logged-in user ---------- */
create or replace function public.my_profile() returns jsonb
language plpgsql security definer set search_path to '' as $$
declare uid uuid := auth.uid(); em text; p public.teacher_profiles; adm boolean;
begin
  if uid is null then raise exception 'not signed in' using errcode = '28000'; end if;
  select lower(email) into em from auth.users where id = uid;
  adm := private.is_admin();
  select * into p from public.teacher_profiles where email = em;
  if not found then
    insert into public.teacher_profiles (email, user_id, approved) values (em, uid, adm) returning * into p;
  elsif p.user_id is distinct from uid then
    update public.teacher_profiles set user_id = uid, updated_at = now() where email = em returning * into p;
  end if;
  return jsonb_build_object('email', em, 'name', coalesce(p.name, split_part(em, '@', 1)),
    'subjects', case when adm then '["physics","maths","science"]'::jsonb else p.subjects end,
    'standards', case when adm then '[8,9,10,11,12]'::jsonb else p.standards end,
    'approved', adm or p.approved, 'is_admin', adm);
end $$;

/* ---------- admin only ---------- */
create or replace function public.admin_list_teachers() returns jsonb
language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object(
            'email', t.email, 'name', coalesce(t.name, split_part(t.email, '@', 1)), 'subjects', t.subjects, 'standards', t.standards,
            'approved', t.approved, 'registered', t.user_id is not null, 'created_at', t.created_at,
            'confirmed', (select u.email_confirmed_at is not null from auth.users u where u.id = t.user_id))
          order by t.approved, t.created_at desc)
          from public.teacher_profiles t where t.email <> private.admin_email()), '[]'::jsonb);
end $$;

create or replace function public.admin_save_teacher(p_email text, p_name text, p_subjects jsonb, p_standards jsonb, p_approved boolean)
returns jsonb language plpgsql security definer set search_path to '' as $$
declare em text := lower(trim(p_email));
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if em is null or em !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid email' using errcode = '22023'; end if;
  insert into public.teacher_profiles (email, user_id, name, subjects, standards, approved)
  values (em, (select id from auth.users where lower(email) = em), nullif(left(trim(p_name), 120), ''),
          private.clean_subjects(p_subjects), private.clean_standards(p_standards), coalesce(p_approved, false))
  on conflict (email) do update
    set name = coalesce(nullif(left(trim(p_name), 120), ''), public.teacher_profiles.name),
        subjects = private.clean_subjects(p_subjects),
        standards = private.clean_standards(p_standards),
        approved = coalesce(p_approved, public.teacher_profiles.approved),
        updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- Removes the teacher from the list (and with it the approval). Their account and saved data stay;
-- if they log in again they show up as "waiting for approval".
create or replace function public.admin_remove_teacher(p_email text) returns jsonb
language plpgsql security definer set search_path to '' as $$
begin
  if not private.is_admin() then raise exception 'admin only' using errcode = '42501'; end if;
  if lower(trim(p_email)) = private.admin_email() then raise exception 'cannot remove admin' using errcode = '22023'; end if;
  delete from public.teacher_profiles where email = lower(trim(p_email));
  return jsonb_build_object('ok', true);
end $$;

/* ---------- sync: approved accounts only ---------- */
create or replace function private.my_space()
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  uid uuid := auth.uid();
  v uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  if not private.is_admin() and not exists (select 1 from public.teacher_profiles where user_id = uid and approved) then
    raise exception 'waiting for admin approval' using errcode = '42501', hint = 'pending_approval';
  end if;
  select id into v from public.sync_spaces where owner = uid;
  if v is null then
    insert into public.sync_spaces (owner) values (uid) on conflict (owner) do nothing;
    select id into v from public.sync_spaces where owner = uid;
  end if;
  update public.sync_spaces set last_seen_at = now() where id = v and last_seen_at < now() - interval '1 minute';
  return v;
end $function$;

create or replace function public.sync_pull_me(p_after bigint default 0, p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v uuid;
  a uuid;
  em text;
  lim integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  out_rows jsonb;
  last_seq bigint;
  n integer;
begin
  v := private.my_space();
  select lower(email) into em from auth.users where id = auth.uid();
  select s.id into a from public.sync_spaces s join auth.users u on u.id = s.owner
   where lower(u.email) = private.admin_email() and u.email_confirmed_at is not null;
  if a = v then a := null; end if;
  select coalesce(jsonb_agg(
           case
             when s.space_id = v or (s.data -> 'assignedTo') ?| array['all', em]
               then jsonb_build_object('kind', s.kind, 'id', s.id, 'data', s.data, 'deleted', s.deleted, 'seq', s.seq)
             -- an admin question no longer assigned to this teacher: arrives as a deletion
             else jsonb_build_object('kind', s.kind, 'id', s.id, 'deleted', true, 'seq', s.seq,
                    'data', jsonb_build_object('id', s.id, 'updatedAt', s.data -> 'updatedAt', 'deletedAt', s.data -> 'updatedAt', 'unassigned', true))
           end order by s.seq), '[]'::jsonb),
         max(s.seq), count(*)
    into out_rows, last_seq, n
    from (select * from public.sync_records r
           where r.seq > coalesce(p_after, 0)
             and (r.space_id = v
                  or (a is not null and r.space_id = a and r.kind = 'questions' and r.data ? 'assignedTo'
                      and jsonb_typeof(r.data -> 'assignedTo') = 'array' and jsonb_array_length(r.data -> 'assignedTo') > 0))
           order by r.seq limit lim) s;
  return jsonb_build_object('rows', out_rows, 'last_seq', coalesce(last_seq, coalesce(p_after, 0)), 'more', n = lim);
end $function$;

revoke all on function private.admin_email(), private.is_admin(), private.clean_subjects(jsonb), private.clean_standards(jsonb),
  private.on_auth_user_created() from public, anon, authenticated;
revoke all on function public.my_profile(), public.admin_list_teachers(), public.admin_save_teacher(text, text, jsonb, jsonb, boolean),
  public.admin_remove_teacher(text) from public, anon;
grant execute on function public.my_profile(), public.admin_list_teachers(), public.admin_save_teacher(text, text, jsonb, jsonb, boolean),
  public.admin_remove_teacher(text) to authenticated;

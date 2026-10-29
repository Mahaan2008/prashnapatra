-- Login-based sync (v0.6): each Supabase Auth user gets one sync space.
-- The functions find the space from the login token (auth.uid()); only logged-in users can call them.
-- Pushes for one space are serialized (row lock), so a pull by sequence number never skips a row.

alter table public.sync_spaces alter column key_hash drop not null;
alter table public.sync_spaces add column if not exists owner uuid unique references auth.users(id) on delete cascade;

create or replace function private.my_space()
returns uuid language plpgsql security definer set search_path to '' as $function$
declare
  uid uuid := auth.uid();
  v uuid;
begin
  if uid is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select id into v from public.sync_spaces where owner = uid;
  if v is null then
    insert into public.sync_spaces (owner) values (uid) on conflict (owner) do nothing;
    select id into v from public.sync_spaces where owner = uid;
  end if;
  update public.sync_spaces set last_seen_at = now() where id = v and last_seen_at < now() - interval '1 minute';
  return v;
end $function$;

create or replace function public.sync_push_me(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v uuid;
  r jsonb;
  n_in integer := 0;
  n_ok integer := 0;
begin
  v := private.my_space();
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'rows must be an array' using errcode = '22023';
  end if;
  if jsonb_array_length(p_rows) > 200 then
    raise exception 'at most 200 rows per call' using errcode = '54000';
  end if;
  perform 1 from public.sync_spaces where id = v for update;
  for r in select value from jsonb_array_elements(p_rows) loop
    n_in := n_in + 1;
    if jsonb_typeof(r -> 'data') is distinct from 'object' then
      raise exception 'row % has no data', n_in using errcode = '22023';
    end if;
    if octet_length((r -> 'data')::text) > 8000000 then
      raise exception 'row % is too large', n_in using errcode = '54000';
    end if;
    insert into public.sync_records as t (space_id, kind, id, data, updated_at, deleted)
    values (v, r ->> 'kind', r ->> 'id', r -> 'data', (r ->> 'updated_at')::timestamptz,
            coalesce((r ->> 'deleted')::boolean, false))
    on conflict (space_id, kind, id) do update
      set data = excluded.data,
          updated_at = excluded.updated_at,
          deleted = excluded.deleted,
          seq = nextval('public.sync_records_seq'),
          server_updated_at = now()
      where excluded.updated_at > t.updated_at;
    if found then n_ok := n_ok + 1; end if;
  end loop;
  return jsonb_build_object('received', n_in, 'applied', n_ok);
end $function$;

create or replace function public.sync_pull_me(p_after bigint default 0, p_limit integer default 200)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare
  v uuid;
  lim integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  out_rows jsonb;
  last_seq bigint;
  n integer;
begin
  v := private.my_space();
  select coalesce(jsonb_agg(jsonb_build_object('kind', s.kind, 'id', s.id, 'data', s.data,
                                               'deleted', s.deleted, 'seq', s.seq) order by s.seq), '[]'::jsonb),
         max(s.seq), count(*)
    into out_rows, last_seq, n
    from (select * from public.sync_records
           where space_id = v and seq > coalesce(p_after, 0)
           order by seq limit lim) s;
  return jsonb_build_object('rows', out_rows, 'last_seq', coalesce(last_seq, coalesce(p_after, 0)), 'more', n = lim);
end $function$;

create or replace function public.sync_status_me()
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare v uuid; res jsonb;
begin
  v := private.my_space();
  select jsonb_build_object(
    'questions', count(*) filter (where kind = 'questions' and not deleted),
    'papers', count(*) filter (where kind = 'papers' and not deleted),
    'templates', count(*) filter (where kind = 'templates' and not deleted),
    'last_seq', coalesce(max(seq), 0))
    into res from public.sync_records where space_id = v;
  return res;
end $function$;

revoke all on function private.my_space() from public, anon, authenticated;
revoke all on function public.sync_push_me(jsonb) from public, anon;
revoke all on function public.sync_pull_me(bigint, integer) from public, anon;
revoke all on function public.sync_status_me() from public, anon;
grant execute on function public.sync_push_me(jsonb) to authenticated;
grant execute on function public.sync_pull_me(bigint, integer) to authenticated;
grant execute on function public.sync_status_me() to authenticated;

select 'sync_auth_v1 applied' as result;

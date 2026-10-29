# Supabase (backend + database)

Live project: **prashnapatra** (`ajrajlytkhgndcyfgwnb`, ap-south-1, free plan), account "Mahaan Thakkar".

Migrations applied (in order):
1. `prashnapatra_sync_v1` — sync tables (`sync_spaces`, `sync_records`, RLS on, no grants) and `sync_push_me`,
   `sync_pull_me`, `sync_status_me`, `sync_ping`.
2. `teachers_v1` (= `teachers_v1.sql`) — teacher approval: `teacher_profiles`, sign-up trigger, `my_profile`,
   admin-only `admin_list_teachers / admin_save_teacher / admin_remove_teacher`, sync refused until approved,
   admin questions assigned to teachers delivered by `sync_pull_me`.
3. `teachers_v1_unassign` — taking an assignment away arrives as a deletion.
4. `admin_approval_and_ai_usage_v1` + `revert_admin_approval_and_ai_usage_v1` — a duplicate approval system added
   by mistake on 29 Oct and removed 10 minutes later; the database is back to `teachers_v1` exactly.

- Admin: `mahaanthakkar2008@gmail.com` (confirmed account).
- Auth: email + password, email confirmation on. Site URL `https://prashnapatra.vercel.app`; redirect URLs
  `https://prashnapatra.vercel.app/**`, `https://mahaan2008.github.io/prashnapatra/**`.
- Gemini: not in Supabase. The key is the Vercel environment variable `GEMINI_API_KEY`, used by `api/gemini.js`,
  which serves approved teachers only (checked with `my_profile`).

`sync_auth_v1.sql` is the upgrade script for the older key-based project (`prashnapatra-sync`, other account) — not used.

# Supabase (backend + database)

Live project: **prashnapatra** (`ajrajlytkhgndcyfgwnb`, ap-south-1, free plan), account "Mahaan Thakkar".
Schema applied as migration `prashnapatra_sync_v1` (same SQL as the login functions in `sync_auth_v1.sql`, with fresh tables).

- Auth: email + password, email confirmation on. Site URL `https://prashnapatra.vercel.app`; redirect URLs
  `https://prashnapatra.vercel.app/**`, `https://mahaan2008.github.io/prashnapatra/**`.
- Tables `sync_spaces` (one per user, `owner` = auth user) and `sync_records`; RLS on, no policies, no grants.
- Functions for logged-in users: `sync_push_me`, `sync_pull_me`, `sync_status_me`; `sync_ping` for the keep-awake job.

`sync_auth_v1.sql` is the upgrade script for the older key-based project (`prashnapatra-sync`, other account) — not used now.

-- Teacher registrations table for Prashnapatra App
-- Run this script in your Supabase Project -> SQL Editor to allow multi-device teacher registrations & approvals.

create table if not exists public.teacher_registrations (
  email text primary key,
  name text,
  subjects jsonb default '["physics"]'::jsonb,
  standards jsonb default '[11]'::jsonb,
  approved boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.teacher_registrations enable row level security;

-- Allow anyone with publishable apikey to insert new registration
drop policy if exists "Anyone can insert teacher registration" on public.teacher_registrations;
create policy "Anyone can insert teacher registration" on public.teacher_registrations
  for insert with check (true);

-- Allow anyone with publishable apikey to read registrations
drop policy if exists "Anyone can read teacher registrations" on public.teacher_registrations;
create policy "Anyone can read teacher registrations" on public.teacher_registrations
  for select using (true);

-- Allow anyone with publishable apikey to update registrations (or UPSERT)
drop policy if exists "Anyone can update teacher registrations" on public.teacher_registrations;
create policy "Anyone can update teacher registrations" on public.teacher_registrations
  for update using (true);

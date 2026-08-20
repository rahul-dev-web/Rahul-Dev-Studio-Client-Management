-- Client portal authentication hardening.
-- Run this migration in Supabase before enabling first-login password rotation.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create policy "clients can update own profile"
on public.profiles
for update
to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

comment on column public.profiles.must_change_password is
  'Forces a newly provisioned client to choose a new password on first portal login.';

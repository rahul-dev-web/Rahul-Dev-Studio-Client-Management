-- Security hardening for role helper functions.
-- These helpers are used by RLS policies and trusted RPCs; they must not be callable anonymously.

revoke execute on function public.is_developer() from public, anon, authenticated;
revoke execute on function public.is_client() from public, anon, authenticated;
grant execute on function public.is_developer() to authenticated;
grant execute on function public.is_client() to authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;

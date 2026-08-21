-- Fix: authenticated developer sessions must be allowed to execute the
-- SECURITY DEFINER role-check function used by RLS policies.
-- Keep the function unavailable to anonymous callers.

grant execute on function public.is_developer() to authenticated;
revoke execute on function public.is_developer() from anon;

comment on function public.is_developer() is
  'Returns true only when the currently authenticated Supabase user has developer role in public.profiles.';

-- Harden exposed RPC execution privileges.
-- Role-check helpers are intentionally internal: application users should not call them directly.
-- Business RPCs remain callable by authenticated users because the web client invokes them directly;
-- each function performs explicit auth.uid()/role/resource checks before mutating data.

revoke all on function public.is_client() from public, anon, authenticated;
revoke all on function public.is_developer() from public, anon, authenticated;

revoke all on function public.client_sign_agreement(uuid, text, text) from public, anon;
revoke all on function public.developer_countersign_agreement(uuid, text, text) from public, anon;
revoke all on function public.review_correction_request(uuid, public.correction_status, text) from public, anon;
revoke all on function public.update_project_topic_status(uuid, text) from public, anon;
revoke all on function public.confirm_project_handover(uuid, text) from public, anon;

-- Keep only the intended authenticated application surface.
grant execute on function public.client_sign_agreement(uuid, text, text) to authenticated;
grant execute on function public.developer_countersign_agreement(uuid, text, text) to authenticated;
grant execute on function public.review_correction_request(uuid, public.correction_status, text) to authenticated;
grant execute on function public.update_project_topic_status(uuid, text) to authenticated;
grant execute on function public.confirm_project_handover(uuid, text) to authenticated;

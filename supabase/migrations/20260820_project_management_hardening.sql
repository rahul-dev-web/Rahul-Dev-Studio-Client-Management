-- RDS client-management hardening applied to the production Supabase project.

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

alter table public.projects
  add column if not exists project_name text;

update public.projects p
set project_name = d.project_name
from public.deals d
where d.id = p.deal_id
  and p.project_name is null;

-- Keep privileged workflow RPCs unavailable to anonymous callers.
revoke execute on function public.client_sign_agreement(uuid,text,text) from anon;
revoke execute on function public.developer_countersign_agreement(uuid,text,text) from anon;
revoke execute on function public.confirm_project_handover(uuid,text) from anon;
revoke execute on function public.review_correction_request(uuid,public.correction_status,text) from anon;
revoke execute on function public.update_project_topic_status(uuid,text) from anon;

-- Trigger functions are invoked by PostgreSQL triggers, not directly through PostgREST.
revoke execute on function public.prevent_signature_mutation() from anon, authenticated;
revoke execute on function public.prevent_signed_agreement_core_mutation() from anon, authenticated;
revoke execute on function public.prevent_signed_agreement_version_mutation() from anon, authenticated;

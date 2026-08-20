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

-- Ensure countersigning creates a project with the project name carried from the deal.
create or replace function public.developer_countersign_agreement(p_agreement_id uuid, p_signer_name text, p_signature_data text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  a public.agreements;
  d public.deals;
  uid uuid := auth.uid();
  project_id uuid;
begin
  if uid is null or not public.is_developer() then raise exception 'Only a developer can countersign an agreement'; end if;
  if trim(coalesce(p_signer_name,''))='' or trim(coalesce(p_signature_data,''))='' then raise exception 'Signer name and signature are required'; end if;
  select * into a from public.agreements where id=p_agreement_id for update;
  if a.id is null then raise exception 'Agreement not found'; end if;
  if a.status<>'client_signed' then raise exception 'Client must sign before countersigning'; end if;
  if exists(select 1 from public.signatures where agreement_id=a.id and signer_role='developer') then raise exception 'Developer countersignature already exists'; end if;
  insert into public.signatures(agreement_id,signer_id,signer_role,signer_name,signature_data)
  values(a.id,uid,'developer',trim(p_signer_name),p_signature_data);
  update public.agreements
  set status='executed',developer_signed_at=now(),executed_at=now(),updated_at=now()
  where id=a.id;
  update public.deals
  set status='active',client_id=a.client_id,updated_at=now()
  where id=a.deal_id;
  select * into d from public.deals where id=a.deal_id;
  insert into public.projects(deal_id,agreement_id,client_id,project_name,status,start_date,expected_delivery_date)
  values(a.deal_id,a.id,a.client_id,d.project_name,'in_development',d.start_date,d.expected_delivery_date)
  on conflict(deal_id) do update set
    agreement_id=excluded.agreement_id,
    client_id=excluded.client_id,
    project_name=excluded.project_name,
    status='in_development',
    start_date=excluded.start_date,
    expected_delivery_date=excluded.expected_delivery_date,
    updated_at=now()
  returning id into project_id;
  return jsonb_build_object('success',true,'status','executed','project_id',project_id);
end;
$function$;

-- Keep privileged workflow RPCs unavailable to anonymous callers.
revoke execute on function public.client_sign_agreement(uuid,text,text) from anon;
revoke execute on function public.developer_countersign_agreement(uuid,text,text) from anon;
revoke execute on function public.confirm_project_handover(uuid,text) from anon;
revoke execute on function public.review_correction_request(uuid,public.correction_status,text) from anon;
revoke execute on function public.update_project_topic_status(uuid,text) from anon;

-- Trigger functions are invoked by PostgreSQL triggers, not directly through PostgREST.
revoke execute on function public.prevent_signature_mutation() from public, anon, authenticated;
revoke execute on function public.prevent_signed_agreement_core_mutation() from public, anon, authenticated;
revoke execute on function public.prevent_signed_agreement_version_mutation() from public, anon, authenticated;

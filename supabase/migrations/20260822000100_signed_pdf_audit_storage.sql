create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id) on delete set null, actor_role public.app_role,
  action text not null, entity_type text not null, entity_id uuid, metadata jsonb not null default '{}'::jsonb, created_at timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "developers read audit log" on public.audit_log for select using (public.is_developer());
create index if not exists audit_log_entity_idx on public.audit_log(entity_type, entity_id, created_at desc);
create index if not exists audit_log_actor_idx on public.audit_log(actor_id, created_at desc);

create table if not exists public.agreement_documents (
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.agreements(id) on delete cascade,
  version integer not null, document_type text not null default 'signed_final', storage_bucket text not null default 'signed-agreements',
  storage_path text not null, content_hash text, generated_at timestamptz not null default now(), unique (agreement_id, version, document_type)
);
alter table public.agreement_documents enable row level security;
create policy "developers read agreement documents" on public.agreement_documents for select using (public.is_developer());
create policy "clients read own agreement documents" on public.agreement_documents for select using (exists (select 1 from public.agreements a where a.id=agreement_id and a.client_id=auth.uid()));
create index if not exists agreement_documents_agreement_idx on public.agreement_documents(agreement_id, version desc);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('signed-agreements','signed-agreements',false,10485760,array['application/pdf'])
on conflict (id) do update set public=false,file_size_limit=10485760,allowed_mime_types=array['application/pdf'];

create or replace function public.write_audit_log(p_action text,p_entity_type text,p_entity_id uuid,p_metadata jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path=public as $$
begin
 insert into public.audit_log(actor_id,actor_role,action,entity_type,entity_id,metadata)
 select auth.uid(),role,p_action,p_entity_type,p_entity_id,coalesce(p_metadata,'{}'::jsonb) from public.profiles where id=auth.uid();
end; $$;
revoke all on function public.write_audit_log(text,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.write_audit_log(text,text,uuid,jsonb) to authenticated;

revoke execute on function public.client_sign_agreement(uuid,text,text) from anon;
revoke execute on function public.developer_countersign_agreement(uuid,text,text) from anon;
revoke execute on function public.confirm_project_handover(uuid,text) from anon;
revoke execute on function public.review_correction_request(uuid,public.correction_status,text) from anon;
revoke execute on function public.update_project_topic_status(uuid,text) from anon;
revoke execute on function public.is_developer() from anon;
revoke execute on function public.is_client() from anon;
grant execute on function public.is_developer() to authenticated;
grant execute on function public.is_client() to authenticated;
grant execute on function public.client_sign_agreement(uuid,text,text) to authenticated;
grant execute on function public.developer_countersign_agreement(uuid,text,text) to authenticated;
grant execute on function public.confirm_project_handover(uuid,text) to authenticated;
grant execute on function public.review_correction_request(uuid,public.correction_status,text) to authenticated;
grant execute on function public.update_project_topic_status(uuid,text) to authenticated;

create or replace function public.audit_agreement_changes() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='INSERT' then perform public.write_audit_log('agreement_created','agreement',new.id,jsonb_build_object('status',new.status,'version',new.version));
 elsif tg_op='UPDATE' then
  if new.status is distinct from old.status then perform public.write_audit_log('agreement_status_changed','agreement',new.id,jsonb_build_object('from',old.status,'to',new.status)); end if;
  if new.client_signed_at is distinct from old.client_signed_at and new.client_signed_at is not null then perform public.write_audit_log('client_signed','agreement',new.id,jsonb_build_object('signed_at',new.client_signed_at)); end if;
  if new.developer_signed_at is distinct from old.developer_signed_at and new.developer_signed_at is not null then perform public.write_audit_log('developer_countersigned','agreement',new.id,jsonb_build_object('signed_at',new.developer_signed_at)); end if;
  if new.executed_at is distinct from old.executed_at and new.executed_at is not null then perform public.write_audit_log('agreement_executed','agreement',new.id,jsonb_build_object('executed_at',new.executed_at)); end if;
 end if; return new; end; $$;
drop trigger if exists agreement_audit_trigger on public.agreements;
create trigger agreement_audit_trigger after insert or update on public.agreements for each row execute function public.audit_agreement_changes();

create or replace function public.audit_project_changes() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' then
  if new.status is distinct from old.status then perform public.write_audit_log('project_status_changed','project',new.id,jsonb_build_object('from',old.status,'to',new.status)); end if;
  if new.handover_confirmed_at is distinct from old.handover_confirmed_at and new.handover_confirmed_at is not null then perform public.write_audit_log('handover_confirmed','project',new.id,jsonb_build_object('confirmed_at',new.handover_confirmed_at)); end if;
  if new.completed_at is distinct from old.completed_at and new.completed_at is not null then perform public.write_audit_log('project_completed','project',new.id,jsonb_build_object('completed_at',new.completed_at)); end if;
 end if; return new; end; $$;
drop trigger if exists project_audit_trigger on public.projects;
create trigger project_audit_trigger after update on public.projects for each row execute function public.audit_project_changes();

create or replace function public.audit_sensitive_inserts() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if tg_table_name='signatures' then perform public.write_audit_log('signature_recorded','agreement',new.agreement_id,jsonb_build_object('signer_id',new.signer_id,'signer_role',new.signer_role,'signed_at',new.signed_at));
 elsif tg_table_name='correction_requests' then perform public.write_audit_log('correction_requested','agreement',new.agreement_id,jsonb_build_object('request_id',new.id,'section',new.section));
 elsif tg_table_name='progress_history' then perform public.write_audit_log('progress_changed','project',new.project_id,jsonb_build_object('progress_percent',new.progress_percent,'topic_id',new.topic_id,'new_status',new.new_status)); end if;
 return new; end; $$;
drop trigger if exists signatures_audit_trigger on public.signatures;
create trigger signatures_audit_trigger after insert on public.signatures for each row execute function public.audit_sensitive_inserts();
drop trigger if exists correction_audit_trigger on public.correction_requests;
create trigger correction_audit_trigger after insert on public.correction_requests for each row execute function public.audit_sensitive_inserts();
drop trigger if exists progress_audit_trigger on public.progress_history;
create trigger progress_audit_trigger after insert on public.progress_history for each row execute function public.audit_sensitive_inserts();

drop policy if exists "developers read signed agreement files" on storage.objects;
create policy "developers read signed agreement files" on storage.objects for select to authenticated using (bucket_id='signed-agreements' and public.is_developer());
drop policy if exists "clients read own signed agreement files" on storage.objects;
create policy "clients read own signed agreement files" on storage.objects for select to authenticated using (bucket_id='signed-agreements' and exists (select 1 from public.agreement_documents d join public.agreements a on a.id=d.agreement_id where d.storage_bucket=storage.objects.bucket_id and d.storage_path=storage.objects.name and a.client_id=auth.uid()));
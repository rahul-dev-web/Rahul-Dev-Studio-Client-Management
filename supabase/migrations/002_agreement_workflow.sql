-- Agreement workflow helpers for the existing Deal -> Agreement schema.
-- Safe to apply after 0001_client_management.sql and 0002_signature_workflow.sql.

create or replace function public.create_agreement_version(
  p_agreement_id uuid,
  p_snapshot jsonb,
  p_scope text[] default '{}',
  p_deliverables text[] default '{}'
)
returns public.agreements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_agreement public.agreements;
  v_next integer;
  v_hash text;
begin
  if not public.is_developer() then raise exception 'Developer access required'; end if;
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if not found then raise exception 'Agreement not found'; end if;
  if v_agreement.status in ('client_signed','executed','superseded') then raise exception 'Signed agreements are immutable; create an amendment instead'; end if;
  v_next := v_agreement.version + 1;
  v_hash := encode(digest(convert_to(p_snapshot::text, 'utf8'), 'sha256'), 'hex');
  insert into public.agreement_versions (agreement_id, version, snapshot, content_hash) values (p_agreement_id, v_next, p_snapshot, v_hash);
  update public.agreements set version=v_next, updated_at=now() where id=p_agreement_id returning * into v_agreement;
  return v_agreement;
end;
$$;

create or replace function public.send_agreement(p_agreement_id uuid)
returns public.agreements
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_agreement public.agreements;
  v_client_id uuid;
begin
  if not public.is_developer() then raise exception 'Developer access required'; end if;
  select * into v_agreement from public.agreements where id=p_agreement_id for update;
  if not found then raise exception 'Agreement not found'; end if;
  if v_agreement.status in ('client_signed','executed','superseded') then raise exception 'Agreement cannot be sent in its current state'; end if;
  select client_id into v_client_id from public.deals where id=v_agreement.deal_id;
  update public.agreements set status='sent', client_id=coalesce(v_agreement.client_id,v_client_id), sent_at=coalesce(sent_at,now()), updated_at=now() where id=p_agreement_id returning * into v_agreement;
  update public.deals set status='agreement_pending', client_id=coalesce(client_id,v_client_id), updated_at=now() where id=v_agreement.deal_id;
  return v_agreement;
end;
$$;

revoke all on function public.create_agreement_version(uuid,jsonb,text[],text[]) from public;
grant execute on function public.create_agreement_version(uuid,jsonb,text[],text[]) to authenticated;
revoke all on function public.send_agreement(uuid) from public;
grant execute on function public.send_agreement(uuid) to authenticated;

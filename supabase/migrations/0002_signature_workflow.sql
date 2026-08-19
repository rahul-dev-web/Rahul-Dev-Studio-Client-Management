-- Signature workflow: client e-sign -> developer countersign -> executed project

create or replace function public.client_sign_agreement(
  p_agreement_id uuid,
  p_signer_name text,
  p_signature_data text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agreements;
  uid uuid := auth.uid();
begin
  if uid is null or not public.is_client() then
    raise exception 'Only an authenticated client can sign an agreement';
  end if;

  if trim(coalesce(p_signer_name, '')) = '' or trim(coalesce(p_signature_data, '')) = '' then
    raise exception 'Signer name and signature are required';
  end if;

  select * into a from public.agreements where id = p_agreement_id for update;

  if a.id is null then raise exception 'Agreement not found'; end if;
  if a.client_id <> uid then raise exception 'You are not authorized to sign this agreement'; end if;
  if a.status not in ('sent', 'under_review', 'correction_requested') then
    raise exception 'This agreement is not available for signing';
  end if;

  if exists (select 1 from public.signatures where agreement_id = a.id and signer_role = 'client') then
    raise exception 'Client signature already exists';
  end if;

  insert into public.signatures (agreement_id, signer_id, signer_role, signer_name, signature_data)
  values (a.id, uid, 'client', trim(p_signer_name), p_signature_data);

  update public.agreements
  set status = 'client_signed', client_signed_at = now(), updated_at = now()
  where id = a.id;

  return jsonb_build_object('success', true, 'status', 'client_signed');
end;
$$;

create or replace function public.developer_countersign_agreement(
  p_agreement_id uuid,
  p_signer_name text,
  p_signature_data text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  a public.agreements;
  d public.deals;
  uid uuid := auth.uid();
  project_id uuid;
begin
  if uid is null or not public.is_developer() then
    raise exception 'Only a developer can countersign an agreement';
  end if;

  if trim(coalesce(p_signer_name, '')) = '' or trim(coalesce(p_signature_data, '')) = '' then
    raise exception 'Signer name and signature are required';
  end if;

  select * into a from public.agreements where id = p_agreement_id for update;
  if a.id is null then raise exception 'Agreement not found'; end if;
  if a.status <> 'client_signed' then raise exception 'Client must sign before countersigning'; end if;
  if exists (select 1 from public.signatures where agreement_id = a.id and signer_role = 'developer') then
    raise exception 'Developer countersignature already exists';
  end if;

  insert into public.signatures (agreement_id, signer_id, signer_role, signer_name, signature_data)
  values (a.id, uid, 'developer', trim(p_signer_name), p_signature_data);

  update public.agreements
  set status = 'executed', developer_signed_at = now(), executed_at = now(), updated_at = now()
  where id = a.id;

  update public.deals set status = 'active', client_id = a.client_id, updated_at = now() where id = a.deal_id;

  select * into d from public.deals where id = a.deal_id;

  insert into public.projects (deal_id, agreement_id, client_id, status, start_date, expected_delivery_date)
  values (a.deal_id, a.id, a.client_id, 'in_development', d.start_date, d.expected_delivery_date)
  on conflict (deal_id) do update set agreement_id = excluded.agreement_id, client_id = excluded.client_id, status = 'in_development', updated_at = now()
  returning id into project_id;

  return jsonb_build_object('success', true, 'status', 'executed', 'project_id', project_id);
end;
$$;

revoke all on function public.client_sign_agreement(uuid, text, text) from public;
grant execute on function public.client_sign_agreement(uuid, text, text) to authenticated;
revoke all on function public.developer_countersign_agreement(uuid, text, text) from public;
grant execute on function public.developer_countersign_agreement(uuid, text, text) to authenticated;

-- Signature rows are written through the controlled RPCs above.
create policy "clients can read agreement signatures" on public.signatures for select
using (exists (select 1 from public.agreements a where a.id = agreement_id and a.client_id = auth.uid()));

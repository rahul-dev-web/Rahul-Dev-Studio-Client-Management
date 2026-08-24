-- Client signatures use typed identity confirmation instead of canvas/drawn data.
alter table public.signatures add column if not exists signer_email text;
alter table public.signatures alter column signature_data drop not null;

drop function if exists public.sign_public_agreement(text,text,text);
create function public.sign_public_agreement(p_token_hash text,p_signer_name text,p_signer_email text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare aid uuid; acode text; aversion integer; sigid uuid; clean_name text:=trim(coalesce(p_signer_name,'')); clean_email text:=lower(trim(coalesce(p_signer_email,'')));
begin
  if length(clean_name)<2 then raise exception 'Please provide your full name'; end if;
  if clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Please provide a valid email address'; end if;
  select a.id,a.agreement_code,a.version into aid,acode,aversion from public.agreements a where a.access_token_hash=p_token_hash and a.status in ('sent','under_review');
  if aid is null then raise exception 'This agreement is not available for signing'; end if;
  if exists(select 1 from public.signatures where agreement_id=aid and signer_role='client') then raise exception 'This agreement has already been signed by the client'; end if;
  insert into public.signatures(agreement_id,signer_id,signer_role,signer_name,signer_email,signature_data) values(aid,null,'client',clean_name,clean_email,null) returning id into sigid;
  update public.agreements set status='client_signed',client_signed_at=now(),updated_at=now() where id=aid;
  insert into public.audit_log(actor_id,actor_role,action,entity_type,entity_id,metadata) values(null,'client','public_client_signed','agreement',aid,jsonb_build_object('signature_id',sigid,'signer_name',clean_name,'signer_email',clean_email,'version',aversion,'signature_method','typed_name_email'));
  return jsonb_build_object('agreement_id',aid,'agreement_code',acode,'version',aversion,'signature_id',sigid,'signed_at',now(),'signer_name',clean_name,'signer_email',clean_email);
end; $$;

drop function if exists public.client_sign_agreement(uuid,text,text);
create function public.client_sign_agreement(p_agreement_id uuid,p_signer_name text,p_signer_email text)
returns jsonb language plpgsql security definer set search_path to 'public' as $$
declare a public.agreements; uid uuid:=auth.uid(); clean_name text:=trim(coalesce(p_signer_name,'')); clean_email text:=lower(trim(coalesce(p_signer_email,'')));
begin
  if uid is null or not public.is_client() then raise exception 'Only an authenticated client can sign an agreement'; end if;
  if length(clean_name)<2 or clean_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Full name and a valid email address are required'; end if;
  select * into a from public.agreements where id=p_agreement_id for update;
  if a.id is null then raise exception 'Agreement not found'; end if;
  if a.client_id<>uid then raise exception 'You are not authorized to sign this agreement'; end if;
  if a.status not in ('sent','under_review','correction_requested') then raise exception 'This agreement is not available for signing'; end if;
  if exists(select 1 from public.signatures where agreement_id=a.id and signer_role='client') then raise exception 'Client signature already exists'; end if;
  insert into public.signatures(agreement_id,signer_id,signer_role,signer_name,signer_email,signature_data) values(a.id,uid,'client',clean_name,clean_email,null);
  update public.agreements set status='client_signed',client_signed_at=now(),updated_at=now() where id=a.id;
  return jsonb_build_object('success',true,'status','client_signed','signature_method','typed_name_email');
end; $$;
-- Signed agreement hardening
-- Keeps executed/signed agreement history immutable at the database layer.
-- Amendments must be created as new agreement versions instead of mutating signed data.

create or replace function public.prevent_signed_agreement_version_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_status public.agreement_status;
begin
  select status into v_status
  from public.agreements
  where id = coalesce(old.agreement_id, new.agreement_id);

  if v_status in ('client_signed', 'executed', 'superseded') then
    raise exception 'Signed agreement versions are immutable; create a new amendment/version instead';
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists agreement_versions_immutable on public.agreement_versions;
create trigger agreement_versions_immutable
before update or delete on public.agreement_versions
for each row execute function public.prevent_signed_agreement_version_mutation();

create or replace function public.prevent_signature_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  raise exception 'Signature records are immutable';
end;
$$;

drop trigger if exists signatures_immutable on public.signatures;
create trigger signatures_immutable
before update or delete on public.signatures
for each row execute function public.prevent_signature_mutation();

create or replace function public.prevent_signed_agreement_core_mutation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status in ('client_signed', 'executed', 'superseded') then
    if new.deal_id is distinct from old.deal_id
       or new.client_id is distinct from old.client_id
       or new.agreement_code is distinct from old.agreement_code
       or new.version is distinct from old.version
       or new.access_token_hash is distinct from old.access_token_hash
       or new.created_at is distinct from old.created_at then
      raise exception 'Signed agreement core fields are immutable; create an amendment/version instead';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists agreements_signed_core_immutable on public.agreements;
create trigger agreements_signed_core_immutable
before update on public.agreements
for each row execute function public.prevent_signed_agreement_core_mutation();

comment on function public.prevent_signed_agreement_version_mutation() is
  'Blocks mutation/deletion of agreement versions after client signature.';
comment on function public.prevent_signature_mutation() is
  'Makes signature audit records append-only.';
comment on function public.prevent_signed_agreement_core_mutation() is
  'Prevents signed agreement identity/version/token fields from being altered.';

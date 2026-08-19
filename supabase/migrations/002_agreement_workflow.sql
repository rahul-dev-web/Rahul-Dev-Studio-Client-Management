-- Agreement workflow: developer access + immutable versioning helpers.
-- Safe to apply after supabase/schema.sql.

create or replace function public.is_developer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'developer'
  );
$$;

create policy "developers manage projects" on public.projects
for all using (public.is_developer()) with check (public.is_developer());

create policy "developers manage agreements" on public.agreements
for all using (public.is_developer()) with check (public.is_developer());

create policy "developers manage agreement versions" on public.agreement_versions
for all using (public.is_developer()) with check (public.is_developer());

create policy "developers manage agreement scope" on public.agreement_scope
for all using (public.is_developer()) with check (public.is_developer());

create policy "developers manage agreement deliverables" on public.agreement_deliverables
for all using (public.is_developer()) with check (public.is_developer());

create policy "developers manage correction requests" on public.correction_requests
for all using (public.is_developer()) with check (public.is_developer());

create policy "developers manage signatures" on public.signatures
for all using (public.is_developer()) with check (public.is_developer());

create policy "developers manage progress history" on public.progress_history
for all using (public.is_developer()) with check (public.is_developer());

create or replace function public.create_agreement_version(
  p_agreement_id uuid,
  p_payload jsonb,
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
  v_item text;
begin
  if not public.is_developer() then
    raise exception 'Developer access required';
  end if;

  select * into v_agreement
  from public.agreements
  where id = p_agreement_id
  for update;

  if not found then
    raise exception 'Agreement not found';
  end if;

  if v_agreement.status in ('client_signed', 'executed', 'superseded') then
    raise exception 'Signed agreements are immutable; create an amendment instead';
  end if;

  v_next := v_agreement.current_version + 1;

  insert into public.agreement_versions (agreement_id, version, payload, created_by)
  values (p_agreement_id, v_next, p_payload, auth.uid());

  delete from public.agreement_scope where agreement_id = p_agreement_id;
  foreach v_item in array coalesce(p_scope, '{}') loop
    if btrim(v_item) <> '' then
      insert into public.agreement_scope (agreement_id, title, position)
      values (p_agreement_id, btrim(v_item),
        (select coalesce(max(position), -1) + 1 from public.agreement_scope where agreement_id = p_agreement_id));
    end if;
  end loop;

  delete from public.agreement_deliverables where agreement_id = p_agreement_id;
  foreach v_item in array coalesce(p_deliverables, '{}') loop
    if btrim(v_item) <> '' then
      insert into public.agreement_deliverables (agreement_id, title, position)
      values (p_agreement_id, btrim(v_item),
        (select coalesce(max(position), -1) + 1 from public.agreement_deliverables where agreement_id = p_agreement_id));
    end if;
  end loop;

  update public.agreements
  set current_version = v_next
  where id = p_agreement_id
  returning * into v_agreement;

  return v_agreement;
end;
$$;

create or replace function public.send_agreement(p_agreement_id uuid)
returns public.agreements
language plpgsql
security invoker
set search_path = public
as $$
declare v_agreement public.agreements;
begin
  if not public.is_developer() then raise exception 'Developer access required'; end if;
  select * into v_agreement from public.agreements where id = p_agreement_id for update;
  if not found then raise exception 'Agreement not found'; end if;
  if v_agreement.status in ('client_signed','executed','superseded') then raise exception 'Agreement cannot be sent in its current state'; end if;
  update public.agreements set status='sent', sent_at=coalesce(sent_at, now()) where id=p_agreement_id returning * into v_agreement;
  return v_agreement;
end;
$$;

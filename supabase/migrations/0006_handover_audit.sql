-- Final handover audit: keep a durable record of who confirmed delivery and any handover note.

alter table public.projects
  add column if not exists handover_confirmed_by uuid references public.profiles(id),
  add column if not exists handover_note text;

create index if not exists projects_handover_confirmed_by_idx
  on public.projects(handover_confirmed_by);

create or replace function public.confirm_project_handover(
  p_project_id uuid,
  p_handover_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.projects;
  completed_at timestamptz := now();
begin
  if uid is null or not public.is_developer() then
    raise exception 'Only a developer can confirm handover';
  end if;

  select * into p
  from public.projects
  where id = p_project_id
  for update;

  if p.id is null then
    raise exception 'Project not found';
  end if;

  if p.status <> 'development_complete' then
    raise exception 'Development must be complete before handover';
  end if;

  update public.projects
  set status = 'completed',
      handover_confirmed_at = completed_at,
      handover_confirmed_by = uid,
      handover_note = nullif(trim(p_handover_note), ''),
      handover_at = completed_at,
      completed_at = completed_at,
      updated_at = completed_at
  where id = p.id;

  update public.deals
  set status = 'completed',
      updated_at = completed_at
  where id = p.deal_id;

  return jsonb_build_object(
    'success', true,
    'status', 'completed',
    'completed_at', completed_at,
    'handover_confirmed_by', uid,
    'handover_note', nullif(trim(p_handover_note), '')
  );
end;
$$;

revoke all on function public.confirm_project_handover(uuid) from public;
revoke all on function public.confirm_project_handover(uuid,text) from public;
grant execute on function public.confirm_project_handover(uuid,text) to authenticated;

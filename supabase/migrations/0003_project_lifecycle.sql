-- Project lifecycle: objective progress, development completion and handover/deal completion.

alter table public.projects
  add column if not exists development_completed_at timestamptz,
  add column if not exists handover_confirmed_at timestamptz,
  add column if not exists completed_at timestamptz;

-- 0001_client_management.sql already creates progress_history with the core
-- progress snapshot columns. Extend that table instead of attempting to
-- recreate it with a conflicting schema.
alter table public.progress_history
  add column if not exists phase_id uuid references public.project_phases(id) on delete set null,
  add column if not exists topic_id uuid references public.phase_topics(id) on delete set null,
  add column if not exists old_status text,
  add column if not exists new_status text;

create index if not exists progress_history_project_idx on public.progress_history(project_id, created_at desc);

create or replace function public.update_project_topic_status(p_topic_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t public.phase_topics;
  old text;
  total_count integer;
  completed_count integer;
  progress_percent integer;
  new_project_status text;
begin
  if uid is null or not public.is_developer() then
    raise exception 'Only a developer can update project progress';
  end if;

  if p_status not in ('pending','in_progress','completed') then
    raise exception 'Invalid topic status';
  end if;

  select * into t
  from public.phase_topics
  where id = p_topic_id
  for update;

  if t.id is null then
    raise exception 'Topic not found';
  end if;

  old := t.status::text;

  update public.phase_topics
  set status = p_status::public.topic_status,
      completed_at = case when p_status = 'completed' then now() else null end,
      updated_at = now()
  where id = t.id;

  select count(*), count(*) filter (where status = 'completed')
  into total_count, completed_count
  from public.phase_topics
  where project_id = t.project_id;

  progress_percent := case
    when total_count = 0 then 0
    else round((completed_count::numeric / total_count::numeric) * 100)::integer
  end;

  if total_count > 0 and completed_count = total_count then
    new_project_status := 'development_complete';

    update public.projects
    set status = new_project_status::public.project_status,
        development_completed_at = coalesce(development_completed_at, now()),
        updated_at = now()
    where id = t.project_id and status <> 'completed';
  else
    new_project_status := 'in_development';

    update public.projects
    set status = new_project_status::public.project_status,
        development_completed_at = null,
        updated_at = now()
    where id = t.project_id and status <> 'completed';
  end if;

  insert into public.progress_history(
    project_id,
    phase_id,
    topic_id,
    changed_by,
    progress_percent,
    old_status,
    new_status,
    note
  )
  values(
    t.project_id,
    t.phase_id,
    t.id,
    uid,
    progress_percent,
    old,
    p_status,
    format('Topic status changed from %s to %s', old, p_status)
  );

  return jsonb_build_object(
    'success', true,
    'project_status', new_project_status,
    'total_topics', total_count,
    'completed_topics', completed_count,
    'progress_percent', progress_percent
  );
end;
$$;

create or replace function public.confirm_project_handover(p_project_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.projects;
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
      handover_confirmed_at = now(),
      handover_at = now(),
      completed_at = now(),
      updated_at = now()
  where id = p.id;

  update public.deals
  set status = 'completed',
      updated_at = now()
  where id = p.deal_id;

  return jsonb_build_object(
    'success', true,
    'status', 'completed',
    'completed_at', now()
  );
end;
$$;

revoke all on function public.update_project_topic_status(uuid,text) from public;
grant execute on function public.update_project_topic_status(uuid,text) to authenticated;
revoke all on function public.confirm_project_handover(uuid) from public;
grant execute on function public.confirm_project_handover(uuid) to authenticated;

alter table public.progress_history enable row level security;

-- Policies are intentionally created here for databases that have already
-- applied 0001 before this lifecycle migration.
drop policy if exists "developers can read progress history" on public.progress_history;
drop policy if exists "clients can read own progress history" on public.progress_history;

create policy "developers can read progress history"
on public.progress_history
for select
using (public.is_developer());

create policy "clients can read own progress history"
on public.progress_history
for select
using (
  exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.client_id = auth.uid()
  )
);

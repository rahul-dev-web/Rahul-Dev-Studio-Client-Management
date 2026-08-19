-- Project lifecycle: objective progress, development completion and handover/deal completion.

alter table public.projects
  add column if not exists development_completed_at timestamptz,
  add column if not exists handover_confirmed_at timestamptz,
  add column if not exists completed_at timestamptz;

create table if not exists public.progress_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_id uuid references public.project_phases(id) on delete set null,
  topic_id uuid references public.phase_topics(id) on delete set null,
  old_status text,
  new_status text not null,
  changed_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

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
  new_project_status text;
begin
  if uid is null or not public.is_developer() then raise exception 'Only a developer can update project progress'; end if;
  if p_status not in ('pending','in_progress','completed') then raise exception 'Invalid topic status'; end if;

  select * into t from public.phase_topics where id = p_topic_id for update;
  if t.id is null then raise exception 'Topic not found'; end if;
  old := t.status;

  update public.phase_topics set status = p_status, updated_at = now() where id = t.id;
  insert into public.progress_history(project_id, phase_id, topic_id, old_status, new_status, changed_by)
  values(t.project_id, t.phase_id, t.id, old, p_status, uid);

  select count(*), count(*) filter (where status = 'completed') into total_count, completed_count
  from public.phase_topics where project_id = t.project_id;

  if total_count > 0 and completed_count = total_count then
    new_project_status := 'development_complete';
    update public.projects set status = new_project_status, development_completed_at = coalesce(development_completed_at, now()), updated_at = now() where id = t.project_id;
  else
    new_project_status := 'in_development';
    update public.projects set status = new_project_status, development_completed_at = null, updated_at = now() where id = t.project_id and status <> 'completed';
  end if;

  return jsonb_build_object('success',true,'project_status',new_project_status,'total_topics',total_count,'completed_topics',completed_count);
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
  a public.agreements;
begin
  if uid is null or not public.is_developer() then raise exception 'Only a developer can confirm handover'; end if;
  select * into p from public.projects where id = p_project_id for update;
  if p.id is null then raise exception 'Project not found'; end if;
  if p.status <> 'development_complete' then raise exception 'Development must be complete before handover'; end if;

  update public.projects set status='completed', handover_confirmed_at=now(), completed_at=now(), updated_at=now() where id=p.id;
  update public.deals set status='completed', updated_at=now() where id=p.deal_id;

  return jsonb_build_object('success',true,'status','completed','completed_at',now());
end;
$$;

revoke all on function public.update_project_topic_status(uuid,text) from public;
grant execute on function public.update_project_topic_status(uuid,text) to authenticated;
revoke all on function public.confirm_project_handover(uuid) from public;
grant execute on function public.confirm_project_handover(uuid) to authenticated;

alter table public.progress_history enable row level security;
create policy "developers can read progress history" on public.progress_history for select using (public.is_developer());
create policy "clients can read own progress history" on public.progress_history for select using (exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()));

-- phase_topics belongs to a project through project_phases.
-- Keep production RPC logic aligned with the normalized schema.

create or replace function public.update_project_topic_status(p_topic_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  uid uuid := auth.uid();
  t public.phase_topics;
  ph public.project_phases;
  p public.projects;
  d public.deals;
  old_status text;
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

  select * into t from public.phase_topics where id = p_topic_id for update;
  if t.id is null then raise exception 'Topic not found'; end if;

  select * into ph from public.project_phases where id = t.phase_id;
  if ph.id is null then raise exception 'Project phase not found for topic'; end if;

  select * into p from public.projects where id = ph.project_id for update;
  if p.id is null then raise exception 'Project not found'; end if;

  select * into d from public.deals where id = p.deal_id;
  if d.id is null or d.developer_id <> uid then
    raise exception 'You are not authorized to update this project';
  end if;

  old_status := t.status::text;

  update public.phase_topics
  set status = p_status::public.topic_status,
      completed_at = case when p_status = 'completed' then now() else null end,
      updated_at = now()
  where id = t.id;

  select count(*), count(*) filter (where pt.status = 'completed')
  into total_count, completed_count
  from public.phase_topics pt
  join public.project_phases pph on pph.id = pt.phase_id
  where pph.project_id = p.id;

  progress_percent := case when total_count = 0 then 0
    else round((completed_count::numeric / total_count::numeric) * 100)::integer
  end;

  if total_count > 0 and completed_count = total_count then
    new_project_status := 'development_complete';
    update public.projects
    set status = 'development_complete',
        development_completed_at = coalesce(development_completed_at, now()),
        updated_at = now()
    where id = p.id and status <> 'completed';
  else
    new_project_status := 'in_development';
    update public.projects
    set status = 'in_development',
        development_completed_at = null,
        updated_at = now()
    where id = p.id and status <> 'completed';
  end if;

  insert into public.progress_history(project_id, phase_id, topic_id, changed_by, progress_percent, old_status, new_status, note)
  values(p.id, t.phase_id, t.id, uid, progress_percent, old_status, p_status,
    format('Topic status changed from %s to %s', old_status, p_status));

  return jsonb_build_object(
    'success', true,
    'project_status', new_project_status,
    'total_topics', total_count,
    'completed_topics', completed_count,
    'progress_percent', progress_percent
  );
end;
$$;

revoke all on function public.update_project_topic_status(uuid,text) from public;
grant execute on function public.update_project_topic_status(uuid,text) to authenticated;

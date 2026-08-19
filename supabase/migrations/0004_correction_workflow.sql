-- Developer review workflow for client correction requests.
-- Accepted requests return the agreement to under_review so the developer can update
-- the deal/agreement and create a new version before sending it back to the client.

create or replace function public.review_correction_request(
  p_request_id uuid,
  p_decision public.correction_status,
  p_response text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.correction_requests;
  a public.agreements;
begin
  if auth.uid() is null or not public.is_developer() then
    raise exception 'Only a developer can review correction requests';
  end if;

  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Decision must be accepted or rejected';
  end if;

  select * into r from public.correction_requests where id = p_request_id for update;
  if r.id is null then raise exception 'Correction request not found'; end if;
  if r.status <> 'pending' then raise exception 'This correction request has already been reviewed'; end if;

  select * into a from public.agreements where id = r.agreement_id for update;
  if a.id is null then raise exception 'Agreement not found'; end if;
  if a.status in ('client_signed','executed','superseded') then
    raise exception 'Signed agreements are immutable; use an amendment instead';
  end if;

  update public.correction_requests
  set status = p_decision,
      developer_response = nullif(trim(coalesce(p_response, '')), ''),
      reviewed_at = now()
  where id = r.id
  returning * into r;

  if p_decision = 'accepted' then
    update public.agreements
    set status = 'under_review', updated_at = now()
    where id = a.id;
  else
    -- If no other request is still pending, return the agreement to review.
    if not exists (
      select 1 from public.correction_requests
      where agreement_id = a.id and status = 'pending'
    ) then
      update public.agreements set status = 'under_review', updated_at = now() where id = a.id;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'request_id', r.id,
    'decision', r.status,
    'agreement_id', a.id,
    'agreement_status', (select status from public.agreements where id = a.id)
  );
end;
$$;

revoke all on function public.review_correction_request(uuid, public.correction_status, text) from public;
grant execute on function public.review_correction_request(uuid, public.correction_status, text) to authenticated;

create index if not exists correction_requests_status_idx on public.correction_requests(status, created_at desc);

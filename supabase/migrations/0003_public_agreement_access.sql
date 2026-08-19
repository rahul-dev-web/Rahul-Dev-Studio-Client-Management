-- Secure private agreement links for client review.
-- Apply after 0001_client_management.sql.

create or replace function public.issue_agreement_access_token(p_agreement_id uuid,p_token_hash text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_developer() then raise exception 'Only developers can issue agreement access links'; end if;
 update public.agreements set access_token_hash=p_token_hash,status=case when status='draft' then 'sent'::public.agreement_status else status end,sent_at=coalesce(sent_at,now()),updated_at=now() where id=p_agreement_id;
 if not found then raise exception 'Agreement not found'; end if;
end; $$;

create or replace function public.get_public_agreement(p_token_hash text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 select jsonb_build_object('agreement',jsonb_build_object('id',a.id,'agreement_code',a.agreement_code,'status',a.status,'version',a.version,'sent_at',a.sent_at,'client_signed_at',a.client_signed_at,'developer_signed_at',a.developer_signed_at),'deal',jsonb_build_object('client_name',d.client_name,'organization',d.organization,'project_name',d.project_name,'project_type',d.project_type,'project_description',d.project_description,'technology',d.technology,'start_date',d.start_date,'expected_delivery_date',d.expected_delivery_date,'total_amount',d.total_amount,'advance_amount',d.advance_amount,'remaining_amount',d.remaining_amount,'payment_schedule',d.payment_schedule,'revision_rounds',d.revision_rounds,'support_days',d.support_days),'version_snapshot',av.snapshot,'scope',coalesce((select jsonb_agg(jsonb_build_object('title',ds.title,'item_order',ds.item_order) order by ds.item_order) from public.deal_scope ds where ds.deal_id=d.id),'[]'::jsonb),'deliverables',coalesce((select jsonb_agg(jsonb_build_object('title',dd.title,'item_order',dd.item_order) order by dd.item_order) from public.deal_deliverables dd where dd.deal_id=d.id),'[]'::jsonb)) into result
 from public.agreements a join public.deals d on d.id=a.deal_id left join lateral(select snapshot from public.agreement_versions x where x.agreement_id=a.id and x.version=a.version limit 1) av on true where a.access_token_hash=p_token_hash;
 if result is null then raise exception 'Invalid or expired agreement link'; end if; return result;
end; $$;

create or replace function public.submit_public_correction_request(p_token_hash text,p_section text,p_request_text text)
returns uuid language plpgsql security definer set search_path=public as $$
declare aid uuid; cid uuid; rid uuid;
begin
 if length(trim(coalesce(p_request_text,'')))<3 then raise exception 'Correction request is too short'; end if;
 select a.id,a.client_id into aid,cid from public.agreements a where a.access_token_hash=p_token_hash and a.status in ('sent','under_review','correction_requested');
 if aid is null then raise exception 'Invalid, expired, or locked agreement link'; end if;
 if cid is null then raise exception 'Client account is not yet associated with this agreement'; end if;
 insert into public.correction_requests(agreement_id,client_id,section,request_text) values(aid,cid,trim(p_section),trim(p_request_text)) returning id into rid;
 update public.agreements set status='correction_requested',updated_at=now() where id=aid;
 return rid;
end; $$;

revoke all on function public.get_public_agreement(text) from public;
grant execute on function public.get_public_agreement(text) to anon,authenticated;
revoke all on function public.issue_agreement_access_token(uuid,text) from public;
grant execute on function public.issue_agreement_access_token(uuid,text) to authenticated;
revoke all on function public.submit_public_correction_request(text,text,text) from public;
grant execute on function public.submit_public_correction_request(text,text,text) to anon,authenticated;

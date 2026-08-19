-- Rahul Development Studio — Client Management
-- Core data model for Deal → Agreement → Project → Handover.
-- Run this migration in the Supabase SQL editor before using persistence.

create extension if not exists pgcrypto;

create type public.app_role as enum ('developer', 'client');
create type public.deal_status as enum ('draft', 'agreement_pending', 'active', 'completed');
create type public.agreement_status as enum ('draft', 'sent', 'under_review', 'correction_requested', 'client_signed', 'executed', 'superseded');
create type public.project_status as enum ('not_started', 'in_development', 'development_complete', 'handover', 'completed');
create type public.topic_status as enum ('pending', 'in_progress', 'completed');
create type public.correction_status as enum ('pending', 'accepted', 'rejected');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'client',
  full_name text,
  phone text,
  client_code text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deals (
  id uuid primary key default gen_random_uuid(),
  deal_code text unique not null default ('RDS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  developer_id uuid not null references public.profiles(id),
  client_id uuid references public.profiles(id),
  client_name text not null,
  organization text not null,
  client_email text not null,
  client_phone text,
  client_address text,
  project_name text not null,
  project_type text not null,
  project_description text,
  technology text,
  start_date date,
  expected_delivery_date date,
  total_amount numeric(12,2) not null default 0 check (total_amount >= 0),
  advance_amount numeric(12,2) not null default 0 check (advance_amount >= 0),
  remaining_amount numeric(12,2) not null default 0 check (remaining_amount >= 0),
  payment_schedule text,
  revision_rounds integer not null default 2 check (revision_rounds >= 0),
  support_days integer not null default 20 check (support_days >= 0),
  status public.deal_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.deal_scope (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  item_order integer not null default 0,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.deal_deliverables (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references public.deals(id) on delete cascade,
  item_order integer not null default 0,
  title text not null,
  created_at timestamptz not null default now()
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_code text unique not null default ('RDS-' || to_char(now(), 'YYYY') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  deal_id uuid not null references public.deals(id),
  client_id uuid references public.profiles(id),
  status public.agreement_status not null default 'draft',
  version integer not null default 1 check (version > 0),
  access_token_hash text unique,
  sent_at timestamptz,
  client_signed_at timestamptz,
  developer_signed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agreement_versions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  version integer not null check (version > 0),
  snapshot jsonb not null,
  content_hash text,
  created_at timestamptz not null default now(),
  unique (agreement_id, version)
);

create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  client_id uuid not null references public.profiles(id),
  section text not null,
  request_text text not null,
  status public.correction_status not null default 'pending',
  developer_response text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  signer_id uuid not null references public.profiles(id),
  signer_role public.app_role not null,
  signer_name text not null,
  signature_data text not null,
  signed_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  project_code text unique not null default ('RDS-P-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  deal_id uuid not null unique references public.deals(id),
  agreement_id uuid unique references public.agreements(id),
  client_id uuid references public.profiles(id),
  status public.project_status not null default 'not_started',
  start_date date,
  expected_delivery_date date,
  development_completed_at timestamptz,
  handover_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  phase_order integer not null default 0,
  name text not null,
  created_at timestamptz not null default now()
);

create table public.phase_topics (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.project_phases(id) on delete cascade,
  topic_order integer not null default 0,
  title text not null,
  status public.topic_status not null default 'pending',
  completed_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.progress_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  changed_by uuid not null references public.profiles(id),
  progress_percent integer not null check (progress_percent between 0 and 100),
  note text,
  created_at timestamptz not null default now()
);

create index deals_developer_idx on public.deals(developer_id);
create index deals_client_idx on public.deals(client_id);
create index agreements_deal_idx on public.agreements(deal_id);
create index agreements_client_idx on public.agreements(client_id);
create index projects_client_idx on public.projects(client_id);
create index phases_project_idx on public.project_phases(project_id);
create index topics_phase_idx on public.phase_topics(phase_id);
create index corrections_agreement_idx on public.correction_requests(agreement_id);

create or replace function public.is_developer()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'developer') $$;

create or replace function public.is_client()
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'client') $$;

alter table public.profiles enable row level security;
alter table public.deals enable row level security;
alter table public.deal_scope enable row level security;
alter table public.deal_deliverables enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_versions enable row level security;
alter table public.correction_requests enable row level security;
alter table public.signatures enable row level security;
alter table public.projects enable row level security;
alter table public.project_phases enable row level security;
alter table public.phase_topics enable row level security;
alter table public.progress_history enable row level security;

create policy "users can read own profile" on public.profiles for select using (id = auth.uid());
create policy "developers manage deals" on public.deals for all using (developer_id = auth.uid() or public.is_developer()) with check (developer_id = auth.uid() or public.is_developer());
create policy "clients read own deals" on public.deals for select using (client_id = auth.uid());
create policy "developers manage deal scope" on public.deal_scope for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read own deal scope" on public.deal_scope for select using (exists (select 1 from public.deals d where d.id = deal_id and d.client_id = auth.uid()));
create policy "developers manage deliverables" on public.deal_deliverables for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read own deliverables" on public.deal_deliverables for select using (exists (select 1 from public.deals d where d.id = deal_id and d.client_id = auth.uid()));
create policy "developers manage agreements" on public.agreements for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read own agreements" on public.agreements for select using (client_id = auth.uid());
create policy "developers manage agreement versions" on public.agreement_versions for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read agreement versions" on public.agreement_versions for select using (exists (select 1 from public.agreements a where a.id = agreement_id and a.client_id = auth.uid()));
create policy "clients create correction requests" on public.correction_requests for insert with check (client_id = auth.uid());
create policy "clients read own correction requests" on public.correction_requests for select using (client_id = auth.uid());
create policy "developers manage corrections" on public.correction_requests for all using (public.is_developer()) with check (public.is_developer());
create policy "developers manage signatures" on public.signatures for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read own signatures" on public.signatures for select using (signer_id = auth.uid() or exists (select 1 from public.agreements a where a.id = agreement_id and a.client_id = auth.uid()));
create policy "developers manage projects" on public.projects for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read own projects" on public.projects for select using (client_id = auth.uid());
create policy "developers manage phases" on public.project_phases for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read own phases" on public.project_phases for select using (exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()));
create policy "developers manage topics" on public.phase_topics for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read own topics" on public.phase_topics for select using (exists (select 1 from public.project_phases ph join public.projects p on p.id = ph.project_id where ph.id = phase_id and p.client_id = auth.uid()));
create policy "developers manage progress history" on public.progress_history for all using (public.is_developer()) with check (public.is_developer());
create policy "clients read own progress history" on public.progress_history for select using (exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid()));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$ begin insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email)); return new; end $$;

create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

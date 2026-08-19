create extension if not exists pgcrypto;

create type public.user_role as enum ('developer', 'client');
create type public.agreement_status as enum ('draft', 'sent', 'under_review', 'correction_requested', 'client_signed', 'executed', 'superseded');
create type public.project_status as enum ('not_started', 'in_development', 'development_complete', 'handover', 'completed');
create type public.item_status as enum ('pending', 'in_progress', 'completed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.user_role not null default 'client',
  display_name text not null,
  client_code text unique,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id),
  name text not null,
  type text,
  description text,
  technology text,
  start_date date,
  expected_delivery_date date,
  total_amount numeric(12,2),
  advance_amount numeric(12,2),
  remaining_amount numeric(12,2),
  status public.project_status not null default 'not_started',
  completed_at timestamptz,
  handover_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.agreements (
  id uuid primary key default gen_random_uuid(),
  agreement_code text not null unique,
  project_id uuid not null references public.projects(id) on delete cascade,
  client_id uuid not null references public.profiles(id),
  status public.agreement_status not null default 'draft',
  current_version integer not null default 1,
  sent_at timestamptz,
  client_signed_at timestamptz,
  developer_signed_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.agreement_versions (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  version integer not null,
  payload jsonb not null,
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique (agreement_id, version)
);

create table public.agreement_scope (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  title text not null,
  position integer not null default 0
);

create table public.agreement_deliverables (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  title text not null,
  position integer not null default 0
);

create table public.correction_requests (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  client_id uuid not null references public.profiles(id),
  section text not null,
  request text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.project_phases (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0
);

create table public.phase_topics (
  id uuid primary key default gen_random_uuid(),
  phase_id uuid not null references public.project_phases(id) on delete cascade,
  title text not null,
  status public.item_status not null default 'pending',
  position integer not null default 0,
  completed_at timestamptz
);

create table public.progress_history (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  progress_percent numeric(5,2) not null check (progress_percent between 0 and 100),
  recorded_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.signatures (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.agreements(id) on delete cascade,
  signer_id uuid not null references public.profiles(id),
  signer_name text not null,
  signature_text text not null,
  signed_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.agreements enable row level security;
alter table public.agreement_versions enable row level security;
alter table public.agreement_scope enable row level security;
alter table public.agreement_deliverables enable row level security;
alter table public.correction_requests enable row level security;
alter table public.project_phases enable row level security;
alter table public.phase_topics enable row level security;
alter table public.progress_history enable row level security;
alter table public.signatures enable row level security;

create policy "clients read own profile" on public.profiles for select using (id = auth.uid());
create policy "clients read own projects" on public.projects for select using (client_id = auth.uid());
create policy "clients read own agreements" on public.agreements for select using (client_id = auth.uid());
create policy "clients read own agreement versions" on public.agreement_versions for select using (
  exists (select 1 from public.agreements a where a.id = agreement_id and a.client_id = auth.uid())
);
create policy "clients read own scope" on public.agreement_scope for select using (
  exists (select 1 from public.agreements a where a.id = agreement_id and a.client_id = auth.uid())
);
create policy "clients read own deliverables" on public.agreement_deliverables for select using (
  exists (select 1 from public.agreements a where a.id = agreement_id and a.client_id = auth.uid())
);
create policy "clients create correction requests" on public.correction_requests for insert with check (client_id = auth.uid());
create policy "clients read own correction requests" on public.correction_requests for select using (client_id = auth.uid());
create policy "clients read own phases" on public.project_phases for select using (
  exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
);
create policy "clients read own topics" on public.phase_topics for select using (
  exists (
    select 1 from public.project_phases ph
    join public.projects p on p.id = ph.project_id
    where ph.id = phase_id and p.client_id = auth.uid()
  )
);
create policy "clients read own progress history" on public.progress_history for select using (
  exists (select 1 from public.projects p where p.id = project_id and p.client_id = auth.uid())
);
create policy "clients read own signatures" on public.signatures for select using (
  exists (select 1 from public.agreements a where a.id = agreement_id and a.client_id = auth.uid())
);

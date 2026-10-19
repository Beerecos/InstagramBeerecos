-- BeeMarketing — équipe marketing IA : missions, tâches (graphe), activité, validations, mémoire de marque.
-- Les agents sont définis dans le code (versionnés) ; agent_profiles stocke les personnalisations par organisation.

create table public.brand_memory (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  memory jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.agent_profiles (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  agent_key text not null check (agent_key ~ '^[a-z_]{3,40}$'),
  enabled boolean not null default true,
  extra_instructions text check (char_length(extra_instructions) <= 4000),
  updated_at timestamptz not null default now(),
  primary key (organization_id, agent_key)
);

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 160),
  objective text,
  platforms text[] not null default '{instagram}',
  status text not null default 'draft' check (status in ('draft', 'active', 'paused', 'done')),
  starts_on date,
  ends_on date,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_org_idx on public.campaigns (organization_id, created_at desc);

create table public.missions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  campaign_id uuid references public.campaigns (id) on delete set null,
  title text not null check (char_length(title) between 1 and 200),
  request text not null check (char_length(request) between 1 and 4000),
  template text not null,
  objective text not null,
  status text not null default 'planned' check (status in ('planned', 'running', 'waiting_input', 'waiting_validation', 'done', 'error')),
  is_demo boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index missions_org_idx on public.missions (organization_id, created_at desc);

create table public.mission_tasks (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  agent_key text not null,
  title text not null,
  instruction text not null,
  status text not null default 'todo' check (status in ('todo', 'analysis', 'in_progress', 'waiting', 'to_validate', 'validated', 'scheduled', 'published', 'done', 'error')),
  needs text[] not null default '{}',
  requires_approval boolean not null default false,
  input jsonb not null default '{}',
  output jsonb,
  waiting_reason text,
  error text,
  attempts int not null default 0,
  position int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (mission_id, key)
);
create index mission_tasks_mission_idx on public.mission_tasks (mission_id, position);
create index mission_tasks_org_status_idx on public.mission_tasks (organization_id, status);

create table public.task_dependencies (
  task_id uuid not null references public.mission_tasks (id) on delete cascade,
  depends_on_task_id uuid not null references public.mission_tasks (id) on delete cascade,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  primary key (task_id, depends_on_task_id),
  check (task_id <> depends_on_task_id)
);

create table public.activity_logs (
  id bigint generated always as identity primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid references public.missions (id) on delete cascade,
  task_id uuid references public.mission_tasks (id) on delete set null,
  actor text not null,
  message text not null check (char_length(message) <= 2000),
  created_at timestamptz not null default now()
);
create index activity_logs_org_idx on public.activity_logs (organization_id, created_at desc);
create index activity_logs_mission_idx on public.activity_logs (mission_id, created_at desc);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid not null references public.missions (id) on delete cascade,
  task_id uuid not null references public.mission_tasks (id) on delete cascade,
  agent_key text not null,
  title text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'changes_requested')),
  comment text check (char_length(comment) <= 2000),
  decided_by uuid references auth.users (id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index approvals_org_status_idx on public.approvals (organization_id, status, created_at desc);

create table public.content_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  mission_id uuid references public.missions (id) on delete set null,
  task_id uuid references public.mission_tasks (id) on delete set null,
  campaign_id uuid references public.campaigns (id) on delete set null,
  kind text not null,
  platform text,
  pillar text check (pillar in ('reseau_monetise', 'formation', 'digitalisation_ia')),
  mode text check (mode in ('ai', 'human', 'hybrid')),
  title text not null,
  body text not null default '',
  status text not null default 'review',
  scheduled_at timestamptz,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index content_items_org_idx on public.content_items (organization_id, scheduled_at);

-- RLS : lecture par les membres ; écriture par admin et responsable contenu. Les workflows serveur
-- (clé secrète) écrivent l'activité et les sorties d'agents après vérification des droits.
alter table public.brand_memory enable row level security;
alter table public.agent_profiles enable row level security;
alter table public.campaigns enable row level security;
alter table public.missions enable row level security;
alter table public.mission_tasks enable row level security;
alter table public.task_dependencies enable row level security;
alter table public.activity_logs enable row level security;
alter table public.approvals enable row level security;
alter table public.content_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['brand_memory', 'agent_profiles', 'campaigns', 'missions', 'mission_tasks', 'task_dependencies', 'activity_logs', 'approvals', 'content_items'] loop
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member(organization_id))', t || '_read', t);
  end loop;
  foreach t in array array['brand_memory', 'agent_profiles', 'campaigns', 'missions', 'mission_tasks', 'task_dependencies', 'content_items'] loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.has_role(organization_id, array[''admin'', ''content_manager'']::public.app_role[])) with check (public.has_role(organization_id, array[''admin'', ''content_manager'']::public.app_role[]))',
      t || '_write', t);
  end loop;
end $$;

-- Validations : décider est réservé à admin / responsable contenu ; la création vient du moteur (serveur).
create policy approvals_decide on public.approvals for update to authenticated
  using (public.has_role(organization_id, array['admin', 'content_manager']::public.app_role[]))
  with check (public.has_role(organization_id, array['admin', 'content_manager']::public.app_role[]));

-- Toute décision de validation est auditée.
create or replace function public.audit_approval_decision()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    insert into public.audit_logs (organization_id, actor_id, actor_type, action, entity_type, entity_id, metadata)
    values (new.organization_id, (select auth.uid()), case when (select auth.uid()) is null then 'system' else 'user' end,
            'approval.' || new.status, 'approval', new.id::text, jsonb_build_object('task_id', new.task_id, 'mission_id', new.mission_id));
  end if;
  return new;
end;
$$;
create trigger approvals_audit after update on public.approvals
  for each row execute function public.audit_approval_decision();

revoke all on public.brand_memory, public.agent_profiles, public.campaigns, public.missions, public.mission_tasks,
  public.task_dependencies, public.activity_logs, public.approvals, public.content_items from anon;
grant select, insert, update, delete on public.brand_memory, public.agent_profiles, public.campaigns, public.missions,
  public.mission_tasks, public.task_dependencies, public.content_items to authenticated;
grant select on public.activity_logs to authenticated;
grant select, update on public.approvals to authenticated;

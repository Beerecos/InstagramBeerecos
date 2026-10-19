-- BeeSocial AI — fondation : organisations, profils, rôles, adhésions, réglages, connexions fournisseurs, audit.
-- Toutes les tables exposées ont la RLS activée. Les fonctions SECURITY DEFINER fixent search_path = ''.

-- ---------------------------------------------------------------------------
-- Rôles applicatifs (RBAC)
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'content_manager', 'club_manager', 'sales', 'viewer');

create table public.roles (
  key public.app_role primary key,
  label text not null,
  description text not null
);

insert into public.roles (key, label, description) values
  ('admin', 'Administrateur', 'Tous les droits, dont réglages, Autopilot et intégrations.'),
  ('content_manager', 'Responsable contenu', 'Crée, valide et programme les contenus.'),
  ('club_manager', 'Responsable de club', 'Voit les leads et invitations de ses clubs uniquement.'),
  ('sales', 'Commercial', 'Gère les conversations et les leads.'),
  ('viewer', 'Lecteur', 'Consultation uniquement.');

-- ---------------------------------------------------------------------------
-- Utilitaires
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organisations et profils
-- ---------------------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,62}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organizations_updated_at before update on public.organizations
  for each row execute function public.set_updated_at();

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.app_role not null default 'viewer' references public.roles (key),
  -- Périmètre d'un responsable de club (clés étrangères ajoutées avec la table clubs, phase 6).
  club_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index memberships_user_idx on public.memberships (user_id);
create trigger memberships_updated_at before update on public.memberships
  for each row execute function public.set_updated_at();

-- Profil créé automatiquement à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Fonctions d'autorisation (utilisées par toutes les politiques RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_member(org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.has_role(org uuid, allowed public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid()) and m.role = any (allowed)
  );
$$;

-- ---------------------------------------------------------------------------
-- Audit (écriture uniquement via log_audit ou le service serveur)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_type text not null default 'user' check (actor_type in ('user', 'agent', 'system')),
  action text not null,
  entity_type text not null,
  entity_id text,
  -- Ne jamais y mettre email, téléphone ou contenu de message : identifiants et différences de réglages uniquement.
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index audit_logs_org_created_idx on public.audit_logs (organization_id, created_at desc);

create or replace function public.log_audit(
  org uuid, p_action text, p_entity_type text, p_entity_id text, p_metadata jsonb default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and not public.is_member(org) then
    raise exception 'not a member of organization %', org using errcode = '42501';
  end if;
  insert into public.audit_logs (organization_id, actor_id, actor_type, action, entity_type, entity_id, metadata)
  values (org, (select auth.uid()), case when (select auth.uid()) is null then 'system' else 'user' end,
          p_action, p_entity_type, p_entity_id, coalesce(p_metadata, '{}'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Réglages d'organisation (stratégie éditoriale + autonomie)
-- ---------------------------------------------------------------------------
create table public.organization_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  pillar_weights jsonb not null default '{"reseau_monetise": 50, "formation": 25, "digitalisation_ia": 25}',
  mode_weights jsonb not null default '{"human": 40, "ai": 30, "hybrid": 30}',
  posts_per_week int not null default 4 check (posts_per_week between 0 and 28),
  priority_ctas text[] not null default '{CLUB}',
  tone text not null default 'concret, business, pédagogique, humain, direct',
  -- Autopilot désactivé par défaut ; activation réservée aux administrateurs et auditée.
  autonomy_mode text not null default 'manual' check (autonomy_mode in ('manual', 'validation', 'autopilot')),
  autopilot_limits jsonb not null default
    '{"max_posts_per_day": 1, "allowed_hours": [8, 20], "forbidden_weekdays": [0], "allowed_modes": ["human", "hybrid"], "daily_video_budget_eur": 20, "approval_required_formats": ["temoignage", "avatar_ia"]}',
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger organization_settings_updated_at before update on public.organization_settings
  for each row execute function public.set_updated_at();

-- Garde-fou serveur : seul un administrateur peut changer le mode d'autonomie ou ses limites,
-- et chaque changement de réglage est audité (même via l'API, indépendamment de l'interface).
create or replace function public.guard_organization_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (new.autonomy_mode is distinct from old.autonomy_mode or new.autopilot_limits is distinct from old.autopilot_limits)
     and (select auth.uid()) is not null
     and not public.has_role(new.organization_id, array['admin']::public.app_role[]) then
    raise exception 'only admins can change autonomy settings' using errcode = '42501';
  end if;
  new.updated_by := coalesce((select auth.uid()), new.updated_by);
  insert into public.audit_logs (organization_id, actor_id, actor_type, action, entity_type, entity_id, metadata)
  values (new.organization_id, (select auth.uid()),
          case when (select auth.uid()) is null then 'system' else 'user' end,
          case when new.autonomy_mode is distinct from old.autonomy_mode then 'settings.autonomy_changed' else 'settings.updated' end,
          'organization_settings', new.organization_id::text,
          jsonb_build_object('autonomy_mode', jsonb_build_object('from', old.autonomy_mode, 'to', new.autonomy_mode),
                             'pillar_weights', new.pillar_weights, 'posts_per_week', new.posts_per_week));
  return new;
end;
$$;
create trigger organization_settings_guard before update on public.organization_settings
  for each row execute function public.guard_organization_settings();

-- ---------------------------------------------------------------------------
-- Connexions fournisseurs (aucun secret ici : les secrets restent dans l'environnement serveur)
-- ---------------------------------------------------------------------------
create table public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  provider text not null check (provider in ('instagram', 'metricool', 'manychat', 'claude', 'veo', 'runway', 'google_drive', 'supabase')),
  status text not null default 'not_configured' check (status in ('connected', 'not_configured', 'error')),
  capabilities jsonb not null default '{}',
  config jsonb not null default '{}',
  last_checked_at timestamptz,
  last_synced_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, provider)
);
create trigger provider_connections_updated_at before update on public.provider_connections
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Création d'une organisation par un utilisateur connecté (il en devient administrateur)
-- ---------------------------------------------------------------------------
create or replace function public.create_organization(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'authentication required' using errcode = '42501';
  end if;
  insert into public.organizations (name, slug) values (p_name, p_slug) returning id into new_id;
  insert into public.memberships (organization_id, user_id, role) values (new_id, (select auth.uid()), 'admin');
  insert into public.organization_settings (organization_id, updated_by) values (new_id, (select auth.uid()));
  perform public.log_audit(new_id, 'organization.created', 'organization', new_id::text, '{}');
  return new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.roles enable row level security;
alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.audit_logs enable row level security;
alter table public.organization_settings enable row level security;
alter table public.provider_connections enable row level security;

create policy roles_read on public.roles for select to authenticated using (true);

create policy organizations_read on public.organizations for select to authenticated
  using (public.is_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (public.has_role(id, array['admin']::public.app_role[]))
  with check (public.has_role(id, array['admin']::public.app_role[]));

create policy profiles_read on public.profiles for select to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.organization_id = mine.organization_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = profiles.id
    )
  );
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy memberships_read on public.memberships for select to authenticated
  using (public.is_member(organization_id));
create policy memberships_admin_insert on public.memberships for insert to authenticated
  with check (public.has_role(organization_id, array['admin']::public.app_role[]));
create policy memberships_admin_update on public.memberships for update to authenticated
  using (public.has_role(organization_id, array['admin']::public.app_role[]))
  with check (public.has_role(organization_id, array['admin']::public.app_role[]));
create policy memberships_admin_delete on public.memberships for delete to authenticated
  using (public.has_role(organization_id, array['admin']::public.app_role[]) and user_id <> (select auth.uid()));

-- Audit : lecture administrateur ; aucune politique d'écriture (journal inaltérable côté client).
create policy audit_logs_admin_read on public.audit_logs for select to authenticated
  using (public.has_role(organization_id, array['admin']::public.app_role[]));

create policy settings_read on public.organization_settings for select to authenticated
  using (public.is_member(organization_id));
create policy settings_update on public.organization_settings for update to authenticated
  using (public.has_role(organization_id, array['admin', 'content_manager']::public.app_role[]))
  with check (public.has_role(organization_id, array['admin', 'content_manager']::public.app_role[]));

create policy provider_connections_read on public.provider_connections for select to authenticated
  using (public.is_member(organization_id));
create policy provider_connections_admin_write on public.provider_connections for all to authenticated
  using (public.has_role(organization_id, array['admin']::public.app_role[]))
  with check (public.has_role(organization_id, array['admin']::public.app_role[]));

-- Privilèges : rien pour anon ; le minimum pour authenticated (la RLS filtre ensuite).
revoke all on public.roles, public.organizations, public.profiles, public.memberships,
  public.audit_logs, public.organization_settings, public.provider_connections from anon;
grant select on public.roles to authenticated;
grant select, update on public.organizations, public.profiles, public.organization_settings to authenticated;
grant select, insert, update, delete on public.memberships, public.provider_connections to authenticated;
grant select on public.audit_logs to authenticated;

revoke execute on function public.create_organization(text, text), public.log_audit(uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.create_organization(text, text), public.log_audit(uuid, text, text, text, jsonb) to authenticated;
grant execute on function public.is_member(uuid), public.has_role(uuid, public.app_role[]) to authenticated;

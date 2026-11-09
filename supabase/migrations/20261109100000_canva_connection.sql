-- Canva dans le Studio (2026-11-09) : compte Canva connecté par l'API officielle Canva Connect (OAuth + PKCE), pour
-- remplir automatiquement les modèles de marque avec les textes d'un post. Base partagée BeeMarketing, additive et
-- idempotente. RLS SANS politique : jetons lus et écrits par le serveur uniquement (clé secrète), jamais par une session.
--
-- Rollback : drop table if exists public.canva_connection;

create table if not exists public.canva_connection (
  id smallint primary key default 1 check (id = 1),
  display_name text not null default '',
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null,
  scopes text[] not null default '{}',
  capabilities text[] not null default '{}',
  connected_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.canva_connection enable row level security;
revoke all on public.canva_connection from anon, authenticated;

-- Canva dans le Studio (2026-11-09, suite) : modèles de marque choisis par Cédric pour l'onglet Post, chacun classé
-- « post » (une image) ou « carrousel ». Base partagée BeeMarketing, additive et idempotente. Indépendant de la
-- connexion (une reconnexion ne perd pas les choix). RLS SANS politique : lu et écrit par le serveur uniquement.
--
-- Rollback : drop table if exists public.canva_template_choices;

create table if not exists public.canva_template_choices (
  template_id text primary key check (template_id ~ '^[A-Za-z0-9_-]{3,64}$'),
  title text not null default '' check (char_length(title) <= 255),
  kind text not null check (kind in ('post', 'carrousel')),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.canva_template_choices enable row level security;
revoke all on public.canva_template_choices from anon, authenticated;

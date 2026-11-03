-- Publication Instagram directe depuis l'app + DM automatiques « commente MOT → DM » (2026-11-03).
-- Base partagée BeeMarketing : tables préfixées ig_ / cta_, additives et idempotentes. Prérequis : auth.users.
--
-- ig_connection   : compte Instagram connecté (jeton d'accès). RLS SANS politique : lu et écrit seulement par le
--                   serveur (clé secrète). Le jeton ne quitte jamais le serveur.
-- ig_publications : tout ce qui est créé dans l'onglet Post (réel monté, réel IA, post photo / carrousel).
--                   Lecture et brouillons par leur auteur ; le passage « en publication » / « publié » est écrit
--                   par le serveur uniquement (aucune session ne peut se déclarer publiée).
-- cta_campaigns / cta_replies : moteur de DM (webhook Meta), accès serveur uniquement (reprise de 20261019000000).
-- Bucket privé ig-media : photos des posts simples ; Instagram les lit par URL signée le temps de la publication.
--
-- Rollback : drop table if exists cta_replies, cta_campaigns, ig_publications, ig_connection;
--            delete from storage.buckets where id = 'ig-media' (si vide).

create table if not exists public.ig_connection (
  id smallint primary key default 1 check (id = 1),     -- un seul compte Instagram BeeRecos
  ig_user_id text not null,
  username text not null,
  access_token text not null,
  expires_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.ig_connection enable row level security;
revoke all on public.ig_connection from anon, authenticated;

create table if not exists public.ig_publications (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null check (kind in ('reel', 'post')),
  montage_id text,                                      -- réel issu du Studio (montage BeeMarketing)
  title text not null default '' check (char_length(title) <= 120),
  caption text not null default '' check (char_length(caption) <= 2200),
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array' and jsonb_array_length(media) <= 10),
  keyword text check (keyword is null or keyword ~ '^[A-Z0-9À-Ü]{2,30}$'),
  dm_text text check (dm_text is null or char_length(dm_text) <= 900),
  button_title text check (button_title is null or char_length(button_title) <= 20),
  button_url text check (button_url is null or button_url ~ '^https://'),
  status text not null default 'draft' check (status in ('draft', 'publishing', 'published', 'error')),
  container_id text,
  ig_media_id text,
  permalink text,
  published_at timestamptz,
  error text check (error is null or char_length(error) <= 500)
);
create index if not exists ig_publications_author_idx on public.ig_publications (created_by, updated_at desc);
create unique index if not exists ig_publications_montage_idx on public.ig_publications (montage_id) where montage_id is not null;
alter table public.ig_publications enable row level security;

drop policy if exists ig_publications_read on public.ig_publications;
create policy ig_publications_read on public.ig_publications for select to authenticated using (created_by = auth.uid());
drop policy if exists ig_publications_insert on public.ig_publications;
create policy ig_publications_insert on public.ig_publications for insert to authenticated
  with check (created_by = auth.uid() and status = 'draft' and container_id is null and ig_media_id is null and permalink is null and published_at is null);
drop policy if exists ig_publications_update on public.ig_publications;
create policy ig_publications_update on public.ig_publications for update to authenticated
  using (created_by = auth.uid() and status in ('draft', 'error'))
  with check (created_by = auth.uid() and status in ('draft', 'error') and ig_media_id is null and permalink is null and published_at is null);
drop policy if exists ig_publications_delete on public.ig_publications;
create policy ig_publications_delete on public.ig_publications for delete to authenticated using (created_by = auth.uid() and status in ('draft', 'error'));
grant select, insert, update, delete on public.ig_publications to authenticated;

create table if not exists public.cta_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  media_id text not null,
  keyword text not null,
  dm_text text not null,
  button_title text,
  button_url text,
  public_reply text,
  active boolean not null default true,
  label text
);
create index if not exists cta_campaigns_media_idx on public.cta_campaigns (media_id) where active;
alter table public.cta_campaigns add column if not exists publication_id uuid references public.ig_publications (id) on delete set null;
create unique index if not exists cta_campaigns_publication_idx on public.cta_campaigns (publication_id) where publication_id is not null;

create table if not exists public.cta_replies (
  comment_id text primary key,
  created_at timestamptz not null default now(),
  campaign_id uuid not null references public.cta_campaigns (id) on delete cascade,
  ig_user_id text,
  username text,
  comment_text text,
  status text not null default 'pending',
  dm_mode text,
  error text,
  sent_at timestamptz
);
create unique index if not exists cta_replies_one_per_user on public.cta_replies (campaign_id, ig_user_id);
alter table public.cta_campaigns enable row level security;
alter table public.cta_replies enable row level security;
revoke all on public.cta_campaigns, public.cta_replies from anon, authenticated;

insert into storage.buckets (id, name, public) values ('ig-media', 'ig-media', false) on conflict (id) do nothing;

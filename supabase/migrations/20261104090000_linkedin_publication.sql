-- Publication LinkedIn depuis l'onglet Post (2026-11-04) : profil membre d'abord, page BeeRecos après validation LinkedIn.
-- Base partagée BeeMarketing. Additive et idempotente. Prérequis : 20261103120000_instagram_publication.sql.
--
-- li_connection    : compte LinkedIn connecté (jeton OAuth). RLS SANS politique : serveur uniquement.
-- ig_publications  : + texte LinkedIn adaptable, cible (profil / page) et état de la publication LinkedIn. Les colonnes
--                    d'état LinkedIn sont protégées par un déclencheur : une session ne peut jamais se déclarer publiée.
--
-- Rollback : drop trigger if exists ig_publications_linkedin_guard on public.ig_publications;
--            drop function if exists public.ig_publications_linkedin_guard();
--            alter table public.ig_publications drop column if exists linkedin_enabled, drop column if exists linkedin_text,
--              drop column if exists linkedin_target, drop column if exists linkedin_status, drop column if exists linkedin_post_urn,
--              drop column if exists linkedin_published_at, drop column if exists linkedin_error;
--            drop table if exists public.li_connection;

create table if not exists public.li_connection (
  id smallint primary key default 1 check (id = 1),
  member_urn text not null check (member_urn ~ '^urn:li:person:'),
  name text not null default '',
  access_token text not null,
  expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.li_connection enable row level security;
revoke all on public.li_connection from anon, authenticated;

alter table public.ig_publications add column if not exists linkedin_enabled boolean not null default false;
alter table public.ig_publications add column if not exists linkedin_text text check (linkedin_text is null or char_length(linkedin_text) <= 3000);
alter table public.ig_publications add column if not exists linkedin_target text not null default 'profil' check (linkedin_target in ('profil', 'page'));
alter table public.ig_publications add column if not exists linkedin_status text not null default 'none' check (linkedin_status in ('none', 'publishing', 'published', 'error'));
alter table public.ig_publications add column if not exists linkedin_post_urn text;
alter table public.ig_publications add column if not exists linkedin_published_at timestamptz;
alter table public.ig_publications add column if not exists linkedin_error text check (linkedin_error is null or char_length(linkedin_error) <= 500);

-- Les colonnes d'état LinkedIn ne s'écrivent que par le serveur (clé secrète) : pour une session, elles gardent leur valeur.
create or replace function public.ig_publications_linkedin_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.linkedin_status := 'none'; new.linkedin_post_urn := null; new.linkedin_published_at := null; new.linkedin_error := null;
    else
      new.linkedin_status := old.linkedin_status; new.linkedin_post_urn := old.linkedin_post_urn;
      new.linkedin_published_at := old.linkedin_published_at; new.linkedin_error := old.linkedin_error;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists ig_publications_linkedin_guard on public.ig_publications;
create trigger ig_publications_linkedin_guard before insert or update on public.ig_publications
  for each row execute function public.ig_publications_linkedin_guard();

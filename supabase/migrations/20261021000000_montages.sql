-- BeeMarketing — page Montage : une prise filmée, son transcript et son montage edit.json (docs/EDIT-JSON.md).
-- La prise est dans le bucket privé « montages » ; l'application y accède par URL signée, après vérification des droits.

create table public.montages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 160),
  -- Chemin dans le bucket : <organisation>/<montage>/<nom de fichier simple>.
  video_path text not null check (video_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[A-Za-z0-9_.-]{1,120}$'),
  duration_ms int check (duration_ms between 1000 and 600000),
  status text not null default 'uploading' check (status in ('uploading', 'uploaded', 'transcribing', 'ready', 'error')),
  edit jsonb,
  -- Montage avant la dernière coupe appliquée (bouton « Annuler la coupe »).
  previous_edit jsonb,
  captions jsonb,
  -- Îlots de parole mesurés dans le navigateur à l'envoi (recalage du transcript).
  speech_islands jsonb,
  error text check (char_length(error) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index montages_org_idx on public.montages (organization_id, created_at desc);

alter table public.montages enable row level security;

create policy montages_read on public.montages for select to authenticated
  using (public.is_member(organization_id));
create policy montages_write on public.montages for all to authenticated
  using (public.has_role(organization_id, array['admin', 'content_manager']::public.app_role[]))
  with check (public.has_role(organization_id, array['admin', 'content_manager']::public.app_role[]));

revoke all on public.montages from anon;
grant select, insert, update, delete on public.montages to authenticated;

-- Bucket PRIVÉ (contrairement à « reels », public le temps qu'Instagram télécharge) : aucune policy de lecture,
-- l'envoi et la lecture passent par des URL signées créées côté serveur.
insert into storage.buckets (id, name, public)
values ('montages', 'montages', false)
on conflict (id) do nothing;

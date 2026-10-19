-- Campagnes « commente MOT → DM avec bouton » et journal des réponses envoyées.

create table if not exists public.cta_campaigns (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  media_id text not null,              -- ID du post Instagram, ou '*' pour tous les posts
  keyword text not null,               -- mot à commenter ('*' = n'importe quel commentaire)
  dm_text text not null,               -- texte du DM ({username} est remplacé par @pseudo)
  button_title text,                   -- libellé du bouton (ex. « Accéder au guide »)
  button_url text,                     -- lien ouvert par le bouton
  public_reply text,                   -- réponse publique sous le commentaire (optionnelle)
  active boolean not null default true,
  label text
);

create index if not exists cta_campaigns_media_idx on public.cta_campaigns (media_id) where active;

create table if not exists public.cta_replies (
  comment_id text primary key,
  created_at timestamptz not null default now(),
  campaign_id uuid not null references public.cta_campaigns (id) on delete cascade,
  ig_user_id text,
  username text,
  comment_text text,
  status text not null default 'pending',   -- pending | sent | error
  dm_mode text,                             -- button | text
  error text,
  sent_at timestamptz
);

-- Une seule réponse privée par personne et par campagne (règle Instagram + anti-spam).
create unique index if not exists cta_replies_one_per_user on public.cta_replies (campaign_id, ig_user_id);

-- Accès réservé au serveur (clé service_role) : aucune policy publique.
alter table public.cta_campaigns enable row level security;
alter table public.cta_replies enable row level security;

-- Bucket public où l'on dépose les vidéos le temps qu'Instagram les télécharge.
insert into storage.buckets (id, name, public)
values ('reels', 'reels', true)
on conflict (id) do nothing;

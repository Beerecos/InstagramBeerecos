-- Choix produit (19/10/2026) : intégrations directes Instagram + LinkedIn, sans abonnement tiers.
-- On ajoute LinkedIn aux fournisseurs ; Metricool et ManyChat restent acceptés comme options futures.
alter table public.provider_connections drop constraint provider_connections_provider_check;
alter table public.provider_connections add constraint provider_connections_provider_check
  check (provider in ('instagram', 'linkedin', 'metricool', 'manychat', 'claude', 'veo', 'runway', 'google_drive', 'supabase'));

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { parseEdit, type CaptionWord, type Edit, type Range } from "@/domain/video/edit";
import { buildEditComposition } from "@/domain/video/edit-composition";
import { initialEdit, newMontageSchema, safeVideoName, uploadedSchema, videoNameOf, type Montage, type MontageStatus } from "@/domain/video/montage";
import { applyAutoCut, planAutoCut, refineWithEnergy } from "@/domain/video/pipeline";
import { isDemoMode, serverEnv } from "@/lib/env/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUser, requirePermission, type CurrentUser } from "@/server/auth/dal";
import { transcribeWithScribe } from "./scribe";

const BUCKET = "montages";
const COLUMNS = "id, organization_id, title, video_path, duration_ms, status, edit, previous_edit, captions, speech_islands, error, created_at, updated_at";

type Row = Record<string, unknown>;
const toMontage = (r: Row): Montage => ({
  id: r.id as string,
  organizationId: r.organization_id as string,
  title: r.title as string,
  videoPath: r.video_path as string,
  durationMs: (r.duration_ms as number | null) ?? null,
  status: r.status as MontageStatus,
  edit: (r.edit as Edit | null) ?? null,
  previousEdit: (r.previous_edit as Edit | null) ?? null,
  captions: (r.captions as CaptionWord[] | null) ?? null,
  speechIslands: (r.speech_islands as Range[] | null) ?? null,
  error: (r.error as string | null) ?? null,
  createdAt: r.created_at as string,
  updatedAt: r.updated_at as string,
});

export class MontageUnavailableError extends Error {
  constructor() {
    super("Le montage en ligne a besoin de Supabase (stockage des prises) : il n'est pas disponible en mode démo.");
    this.name = "MontageUnavailableError";
  }
}

function orgOf(user: CurrentUser): string {
  if (!user.organization) throw new Error("Aucune organisation : terminez la configuration dans /bienvenue.");
  return user.organization.id;
}

/** Disponibilité de la page : Supabase pour le stockage, ElevenLabs pour la transcription. */
export function montageAvailability() {
  const env = serverEnv();
  return { storage: !isDemoMode(env) && Boolean(env.SUPABASE_SECRET_KEY), transcription: Boolean(env.ELEVENLABS_API_KEY) };
}

async function db(): Promise<SupabaseClient> {
  if (isDemoMode()) throw new MontageUnavailableError();
  return createSupabaseServerClient();
}

export async function listMontages(): Promise<Montage[]> {
  const user = await getCurrentUser();
  if (isDemoMode()) return [];
  const { data, error } = await (await db()).from("montages").select(COLUMNS).eq("organization_id", orgOf(user)).order("created_at", { ascending: false }).limit(50);
  if (error) throw new Error(`Lecture des montages impossible : ${error.message}`);
  return (data ?? []).map(toMontage);
}

/** Lecture sous RLS : un membre d'une autre organisation obtient null. */
export async function getMontage(id: string): Promise<Montage | null> {
  await getCurrentUser();
  if (isDemoMode() || !/^[0-9a-f-]{36}$/.test(id)) return null;
  const { data } = await (await db()).from("montages").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toMontage(data) : null;
}

async function editable(id: string): Promise<{ montage: Montage; client: SupabaseClient }> {
  await requirePermission("content:edit");
  const montage = await getMontage(id);
  if (!montage) throw new Error("Montage introuvable.");
  return { montage, client: await db() };
}

async function update(client: SupabaseClient, id: string, patch: Row) {
  const { error } = await client.from("montages").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) throw new Error(`Enregistrement impossible : ${error.message}`);
}

/**
 * Crée le montage et une URL d'envoi signée : le navigateur envoie la prise directement au stockage
 * (pas de passage par une fonction Vercel, limitée en taille de requête).
 */
export async function createMontage(input: unknown): Promise<{ id: string; path: string; token: string }> {
  const user = await requirePermission("content:edit");
  const orgId = orgOf(user);
  const parsed = newMontageSchema.parse(input);
  const name = safeVideoName(parsed.fileName);
  if (!name) throw new Error("Format non accepté : envoyez une vidéo .mp4, .mov, .m4v ou .webm.");
  const id = crypto.randomUUID();
  const path = `${orgId}/${id}/${name}`;
  const { error } = await (await db()).from("montages").insert({ id, organization_id: orgId, title: parsed.title, video_path: path, created_by: user.id });
  if (error) throw new Error(`Création impossible : ${error.message}`);
  const signed = await createSupabaseAdminClient().storage.from(BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) throw new Error(`Envoi impossible : ${signed.error?.message ?? "URL non créée"}`);
  return { id, path, token: signed.data.token };
}

/** Après l'envoi : vérifie que la prise est bien stockée, enregistre sa durée et le montage initial. */
export async function markUploaded(id: string, input: unknown): Promise<void> {
  const { montage, client } = await editable(id);
  const { durationMs, islands } = uploadedSchema.parse(input);
  const check = await createSupabaseAdminClient().storage.from(BUCKET).createSignedUrl(montage.videoPath, 60);
  if (check.error) throw new Error("La prise n'est pas arrivée dans le stockage : relancez l'envoi.");
  await update(client, id, { status: "uploaded", duration_ms: durationMs, speech_islands: islands, edit: initialEdit(videoNameOf(montage.videoPath), durationMs), error: null });
}

export async function transcribeMontage(id: string): Promise<void> {
  const { montage, client } = await editable(id);
  const key = serverEnv().ELEVENLABS_API_KEY;
  if (!key) throw new Error("Transcription indisponible : ajoutez ELEVENLABS_API_KEY dans les variables d'environnement Vercel.");
  if (!montage.edit) throw new Error("La prise n'est pas encore reçue.");
  await update(client, id, { status: "transcribing", error: null });
  try {
    const signed = await createSupabaseAdminClient().storage.from(BUCKET).createSignedUrl(montage.videoPath, 3600);
    if (signed.error || !signed.data) throw new Error("Lien vers la prise impossible à créer.");
    const words = await transcribeWithScribe(signed.data.signedUrl, key);
    const captions = montage.speechIslands?.length ? refineWithEnergy(words, montage.speechIslands) : words;
    const edit = { ...montage.edit, captions: `${montage.edit.video.replace(/\.[^.]+$/, "")}.json` };
    await update(client, id, { status: "ready", captions, edit });
  } catch (e) {
    await update(client, id, { status: "error", error: e instanceof Error ? e.message : "Transcription impossible." });
    throw e;
  }
}

/** Applique une coupe : phrases choisies retirées, hésitations et silences coupés ; l'ancien montage est gardé. */
export async function applyCut(id: string, drop: number[]): Promise<void> {
  const { montage, client } = await editable(id);
  if (!montage.edit || !montage.captions?.length) throw new Error("Transcrivez la prise avant de couper.");
  const clauses = planAutoCut(montage.captions);
  const ranges = applyAutoCut(montage.captions, clauses, new Set(drop), montage.durationMs ?? undefined);
  if (!ranges.length) throw new Error("Cette coupe ne garde rien : retirez moins de phrases.");
  const parsed = parseEdit({ ...montage.edit, ranges });
  if (!parsed.ok) throw new Error(`Coupe refusée :\n${parsed.errors.join("\n")}`);
  await update(client, id, { edit: parsed.edit, previous_edit: montage.edit });
}

export async function undoCut(id: string): Promise<void> {
  const { montage, client } = await editable(id);
  if (!montage.previousEdit) throw new Error("Aucune coupe à annuler.");
  await update(client, id, { edit: montage.previousEdit, previous_edit: null });
}

/** Composition Hyperframes du montage, la prise lue par URL signée (1 h). */
export async function montageComposition(id: string, assetBase: string): Promise<string | null> {
  const montage = await getMontage(id);
  if (!montage?.edit) return null;
  const signed = await createSupabaseAdminClient().storage.from(BUCKET).createSignedUrl(montage.videoPath, 3600);
  if (signed.error || !signed.data) return null;
  const url = signed.data.signedUrl;
  return buildEditComposition(montage.edit, montage.captions ?? [], { assetBase, preview: true, mediaUrl: () => url });
}

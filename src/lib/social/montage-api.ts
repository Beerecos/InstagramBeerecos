// Client du montage en ligne (fonction serveur `montage`, route /admin). Les contrôles (rôles, format, taille,
// présence de la prise) sont faits côté serveur ; l'interface affiche leur résultat.
import type { StudioSourceRef, StudioSourceTransfer } from "@/domain/social/studio-sources";
import type { KeptMotion } from "@/domain/social/montage/beemotion";
import { apiUrl } from "./api-config";
import { getAccessToken } from "./supabase";
import type { CaptionWord, Edit } from "@/domain/social/montage/edit";
import type { MontageStatus } from "@/domain/social/montage/montage";
import type { CustomAnimation, Rejected, Suggestion } from "@/domain/social/montage/suggest";
import type { FeedbackTurn } from "@/domain/social/montage/feedback";
import type { MediaItem, MediaKind } from "@/domain/social/montage/media";
import type { Brief, CtaObjective, Storyboard, StoryboardStatus, StudioSettings } from "@/domain/social/montage/ideation";
import type { BlockIntent, Hook } from "@/domain/social/montage/narrative";
import type { Reel, ScenePatch } from "@/domain/social/montage/reels";
import type { MontagePost, PostInput } from "@/domain/social/montage/post";
import type { AnimationTemplate } from "@/domain/social/montage/template";

export const isMontageConfigured = Boolean(apiUrl);

async function call<T>(body: Record<string, unknown>): Promise<T> {
  if (!apiUrl) throw new Error("Backend non configuré (NEXT_PUBLIC_BEE_API_URL) : le montage a besoin du serveur BeeMarketing.");
  const token = await getAccessToken();
  const res = await fetch(`${apiUrl}/montage/admin`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Erreur serveur (${res.status})`);
  return data as T;
}

export type RenderStatus = "rendering" | "done" | "failed" | null;
export type MontageSummary = { id: string; title: string; status: MontageStatus; durationMs: number | null; keptMs: number | null; workspaceId: string | null; createdAt: string; updatedAt: string; renderStatus: RenderStatus; sentToReels: boolean; finalVideoUrl?: string | null; archivedAt?: string | null };
export type MontageDetail = MontageSummary & { aiSource?: { source: StudioSourceRef; verified: boolean } | null; edit: Edit | null; captions: CaptionWord[]; canUndo: boolean; canRedo?: boolean; previewApproved?: boolean; previewApprovedAt?: string | null;
  brief?: Brief | null; storyboard?: Storyboard | null; storyboardStatus?: StoryboardStatus | null; storyboardApprovedAt?: string | null; post?: MontagePost | null; reel?: { reelId: string; revision: number; keyword: string; approved: boolean } | null; seededRevision?: number | null; error: string | null; renderError: string | null; finalVideoUrl: string | null };

/** Un des 72 Reels (lot S7) : états réels lus sur son montage lié (null = pas encore filmé). */
export type ReelLinked = {
  montageId: string; hasTake: boolean; transcribed: boolean; seededRevision: number | null; previewApproved: boolean; finalReady: boolean;
  media: "missing" | "processing" | "ready" | "failed"; render: "not_started" | "rendering" | "preview_ready" | "final_ready" | "failed";
  publication: "not_scheduled" | "scheduled"; stale: boolean;
};
export type ReelSummary = {
  id: string; reelId: string; title: string; series: string | null; pillar: string | null; mode: "studio" | "ai" | "hybrid";
  editorial: "draft" | "needs_review" | "approved"; revision: number; keyword: string; edited: boolean; approvedRevision: number | null; approvedAt: string | null;
  linked: ReelLinked | null; todo: string[];
};
export type ReelDetail = ReelSummary & { data: Reel; keywordActive: boolean };
export type ImportReport = { reels: number; scenes: number; inserted: number; updated: string[]; unchanged: number; protected: { reelId: string; why: string }[]; warnings: string[] };
/** Erreur d'import : la liste des contrôles en échec accompagne le message. */
export class ImportError extends Error { constructor(message: string, readonly errors: string[]) { super(message); } }

export const reels = {
  list: () => call<{ reels: ReelSummary[] }>({ action: "reels-list" }),
  get: (reelId: string) => call<{ reel: ReelDetail }>({ action: "reel-get", reelId }),
  import: async (structure: string) => {
    if (!apiUrl) throw new Error("Backend non configuré (NEXT_PUBLIC_BEE_API_URL).");
    const token = await getAccessToken();
    const res = await fetch(`${apiUrl}/montage/admin`, { method: "POST", headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ action: "reels-import", structure }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ImportError(data.error ?? `Erreur serveur (${res.status})`, data.errors ?? []);
    return data as { report: ImportReport };
  },
  saveScene: (reelId: string, revision: number, sceneId: string, patch: ScenePatch) => call<{ revision: number }>({ action: "reel-scene-save", reelId, revision, sceneId, patch }),
  review: (reelId: string, revision: number, status: "approved" | "needs_review") => call<{ ok: true }>({ action: "reel-review", reelId, revision, status }),
  saveCaption: (reelId: string, revision: number, caption: string) => call<{ ok: true }>({ action: "reel-caption-save", reelId, revision, caption }),
  /** Pose les animations du Reel lié sur la prise transcrite du montage. */
  seed: (montageId: string) => call<{ placed: number; warnings: string[]; revision: number }>({ action: "reel-seed", id: montageId }),
};

export const montage = {
  list: (opts: { archived?: boolean } = {}) => call<{ montages: MontageSummary[] }>({ action: "list", ...(opts.archived ? { archived: true } : {}) }),
  /** Corbeille (Instagram BeeRecos) : suppression récupérable, aucun fichier effacé. */
  archive: (id: string) => call<{ archivedAt: string }>({ action: "archive", id }),
  restore: (id: string) => call<{ restored: boolean }>({ action: "restore", id }),
  get: (id: string) => call<{ montage: MontageDetail; videoUrl: string | null; takeUrls?: Record<string, string>; mediaUrls?: Record<string, string>; matteUrls?: Record<string, string> }>({ action: "get", id }),
  create: (p: { title: string; fileName: string; size: number; reelId?: string; aiSource?: StudioSourceTransfer }) => call<{ id: string; uploadUrl: string }>({ action: "create", ...p }),
  uploaded: (id: string, p: { durationMs: number; islands: { fromMs: number; toMs: number }[] | null }) => call<{ ok: true }>({ action: "uploaded", id, ...p }),
  /** Plusieurs prises (lot S3 bis), avant la transcription : dépôt d'une prise de plus, puis enregistrement. */
  addTake: (id: string, p: { fileName: string; size: number }) => call<{ file: string; uploadUrl: string }>({ action: "add-take", id, ...p }),
  takeUploaded: (id: string, p: { file: string; durationMs: number; islands: { fromMs: number; toMs: number }[] | null }) => call<{ takes: number }>({ action: "take-uploaded", id, ...p }),
  removeTake: (id: string, file: string) => call<{ takes: number }>({ action: "remove-take", id, file }),
  /** Détourage d'une prise (lot S5), fait sur le poste : dépôt signé, puis enregistrement contrôlé (durée de la prise). */
  addMatte: (id: string, p: { take: string; fileName: string; size: number }) => call<{ file: string; uploadUrl: string }>({ action: "add-matte", id, ...p }),
  matteUploaded: (id: string, p: { take: string; durationMs: number }) => call<{ file: string }>({ action: "matte-uploaded", id, ...p }),
  removeMatte: (id: string, take: string) => call<{ ok: true }>({ action: "remove-matte", id, take }),
  transcribe: (id: string) => call<{ words: number }>({ action: "transcribe", id }),
  cut: (id: string, drop: number[]) => call<{ ok: true }>({ action: "cut", id, drop }),
  undo: (id: string) => call<{ ok: true }>({ action: "undo", id }),
  redo: (id: string) => call<{ ok: true }>({ action: "redo", id }),
  /** Studio : edit.json complet, refusé si le montage a changé depuis `baseUpdatedAt`. */
  saveEdit: (id: string, edit: Edit, baseUpdatedAt: string) => call<{ ok: true; unchanged?: boolean }>({ action: "save-edit", id, edit, baseUpdatedAt }),
  /** Sous-titres éditables : texte d'un ou plusieurs mots, minutage inchangé. */
  fixWords: (id: string, fixes: { i: number; text: string }[]) => call<{ ok: true }>({ action: "fix-words", id, fixes }),
  /** « Tout auto » : proposition à prévisualiser et valider ; le montage n'est pas enregistré. */
  auto: (id: string, baseUpdatedAt: string) => call<{ dropped: number; animations: number; note: string | null; proposal: Edit; baseUpdatedAt: string }>({ action: "auto", id, baseUpdatedAt }),
  /** Panneau Retours : réponse de Bee et proposition de montage (rien n'est enregistré). */
  feedback: (id: string, message: string, history: FeedbackTurn[]) =>
    call<{ reply: string; proposal: Edit | null; applied: string[]; rejected: { op: string; why: string }[]; baseUpdatedAt?: string }>({ action: "feedback", id, message, history }),
  /** Planche contact : la direction valide cette version (le rendu l'exige). */
  approvePreview: (id: string, baseUpdatedAt: string) => call<{ ok: true }>({ action: "approve-preview", id, baseUpdatedAt }),
  /** Bibliothèque de médias (lot S3) : sons et images avec leur licence. */
  mediaList: () => call<{ media: MediaItem[] }>({ action: "media-list" }),
  mediaCreate: (p: { kind: MediaKind; title: string; fileName: string; size: number; licence: string; sourceUrl?: string }) =>
    call<{ mediaId: string; fileName: string; uploadUrl: string }>({ action: "media-create", ...p }),
  mediaUploaded: (mediaId: string, durationMs: number | null) => call<{ ok: true }>({ action: "media-uploaded", mediaId, durationMs }),
  mediaDelete: (mediaId: string) => call<{ ok: true }>({ action: "media-delete", mediaId }),
  /** Idéation (lot S4) : brief → storyboard proposé par Bee → validé par la direction. */
  saveBrief: (id: string, brief: Brief) => call<{ storyboardStatus: StoryboardStatus | null }>({ action: "brief", id, brief }),
  proposeStoryboard: (id: string) => call<{ storyboard: Storyboard; warnings: string[] }>({ action: "storyboard-propose", id }),
  /** Moteur narratif (HOOK → … → CTA) : 3 hooks + 8 blocs (enregistrés en brouillon), 3 hooks seuls, ou un bloc retouché. */
  proposeNarrative: (id: string, ctaObjectif?: CtaObjective) => call<{ storyboard: Storyboard; hooks: Hook[]; warnings: string[] }>({ action: "narrative-propose", id, mode: "full", ctaObjectif }),
  proposeHooks: (id: string, ctaObjectif?: CtaObjective) => call<{ hooks: Hook[] }>({ action: "narrative-propose", id, mode: "hooks", ctaObjectif }),
  reworkBlock: (id: string, storyboard: Storyboard, index: number, intent: BlockIntent, ctaObjectif?: CtaObjective) =>
    call<{ sequence: Storyboard["sequences"][number]; warnings: string[] }>({ action: "narrative-propose", id, mode: "block", storyboard, index, intent, ctaObjectif }),
  saveStoryboard: (id: string, storyboard: Storyboard, baseUpdatedAt: string) => call<{ warnings: string[] }>({ action: "storyboard-save", id, storyboard, baseUpdatedAt }),
  approveStoryboard: (id: string, baseUpdatedAt: string) => call<{ warnings: string[] }>({ action: "storyboard-approve", id, baseUpdatedAt }),
  /** Styles / préférences et Paramètres du Studio. */
  getSettings: () => call<{ settings: StudioSettings; services: { transcription: boolean; claude: boolean; rendu: boolean; ressources: boolean }; memory: string[] }>({ action: "settings-get" }),
  saveSettings: (settings: StudioSettings) => call<{ settings: StudioSettings }>({ action: "settings-save", settings }),
  /** « Mon modèle » : enregistre la base d'animation du montage (null : retour au Standard BeeRecos v1). */
  saveTemplate: (template: AnimationTemplate | null) => call<{ template: AnimationTemplate | null }>({ action: "template-save", template }),
  saveAnimations: (id: string, custom: CustomAnimation[]) => call<{ ok: true }>({ action: "animations", id, custom }),
  /** BeeMotion : « ON GARDE » enregistrés et usage réel de chaque motion. */
  motionLibrary: () => call<{ kept: KeptMotion[]; usage: Record<string, number> }>({ action: "motion-library" }),
  /** BeeMotion : la direction garde un motion (confirmation explicite « ON GARDE »). */
  keepMotion: (id: string, montageId?: string) => call<{ kept: KeptMotion[] }>({ action: "motion-keep", id, montageId, confirm: "ON GARDE" }),
  suggest: (id: string, baseUpdatedAt: string) => call<{ suggestions: Suggestion[]; rejected: Rejected[] }>({ action: "suggest", id, baseUpdatedAt }),
  render: (id: string) => call<{ renderStatus: RenderStatus }>({ action: "render", id }),
  renderStatus: (id: string) => call<{ renderStatus: RenderStatus; renderError?: string; finalVideoUrl?: string | null; heygenStatus?: string }>({ action: "render-status", id }),
  /** Préparation du post (Instagram BeeRecos) : n'écrit que la légende, jamais la vidéo ni sa version. */
  savePost: (id: string, post: PostInput, baseUpdatedAt: string) => call<{ post: MontagePost }>({ action: "post-save", id, post, baseUpdatedAt }),
  toReel: (id: string, caption: string) => call<{ reelContentId: string; slotAt: string }>({ action: "to-reel", id, caption }),
};
